import {
  checkpointSchema,
  checkpointV3Schema,
  checkpointV2Schema,
  coachTurnDraftSchema,
  hereGuidanceSchema,
  legacyCheckpointSchema,
  lifeDesignResponseSchema,
  type DashboardResponse,
  type CoachTurnDraft,
  type HereGuidance,
  type LifeDesignCheckpoint,
  type LifeDesignCheckpointV2,
  type LifeDesignResponse,
  type TextResponse,
} from './checkpoint'
import { buildHereReflection, hereMicroStepOrder, recommendFocus } from './guidance'
import { steps } from './steps'

function emptyHereGuidance(): HereGuidance {
  return {
    currentMicroStepId: 'here.welcome',
    feelings: [],
    feelingNote: '',
  }
}

export function createCheckpoint(sessionId: string, now: string): LifeDesignCheckpoint {
  return checkpointSchema.parse({
    schemaVersion: 4,
    sessionId,
    revision: 1,
    createdAt: now,
    updatedAt: now,
    stage: 'here',
    currentStepId: steps[0]?.id ?? null,
    completedStepIds: [],
    responses: [],
    pendingOperation: null,
    legacyNotes: [],
    hereGuidance: emptyHereGuidance(),
    stageReflections: {},
    coachPendingAfter: null,
    coachTurns: [],
    blueprint: { status: 'idle' },
  })
}

function normalizeV2Pending(checkpoint: LifeDesignCheckpointV2): LifeDesignCheckpointV2 {
  if (!checkpoint.pendingOperation) return checkpoint

  const completedId = checkpoint.pendingOperation.stepId
  const index = steps.findIndex((step) => step.id === completedId)
  if (index < 0) return { ...checkpoint, pendingOperation: null }
  const next = steps[index + 1] ?? null

  return {
    ...checkpoint,
    stage: next?.stage ?? 'complete',
    currentStepId: next?.id ?? null,
    completedStepIds: Array.from(new Set([...checkpoint.completedStepIds, completedId])),
    pendingOperation: null,
  }
}

function migrateV2Here(checkpoint: LifeDesignCheckpointV2): {
  checkpoint: LifeDesignCheckpointV2
  guidance: HereGuidance | null
} {
  const normalized = normalizeV2Pending(checkpoint)
  const currentIndex = normalized.currentStepId
    ? steps.findIndex((step) => step.id === normalized.currentStepId)
    : steps.length
  const dashboard = normalized.responses.find(
    (response): response is DashboardResponse => response.kind === 'dashboard',
  )
  const primaryProblem = normalized.responses.find(
    (response): response is TextResponse =>
      response.stepId === 'here.primary-problem' && response.kind === 'text',
  )
  const whyNow = normalized.responses.find(
    (response) => response.stepId === 'here.why-now' && response.kind === 'text',
  )

  if (normalized.stage !== 'here' || currentIndex >= 3 || whyNow) {
    if (whyNow && currentIndex < 3) {
      return {
        checkpoint: {
          ...normalized,
          stage: 'compass',
          currentStepId: 'compass.workview',
          completedStepIds: Array.from(
            new Set([
              ...normalized.completedStepIds,
              'here.dashboard',
              'here.primary-problem',
              'here.why-now',
            ]),
          ),
        },
        guidance: null,
      }
    }
    return { checkpoint: normalized, guidance: null }
  }

  if (primaryProblem) {
    const focus = dashboard ? recommendFocus(dashboard.scores)[0] : 'work'
    return {
      checkpoint: normalized,
      guidance: hereGuidanceSchema.parse({
        currentMicroStepId: 'here.moment-when',
        scores: dashboard?.scores,
        focus,
        problemShapeId: `${focus}.other`,
        problemStatement: primaryProblem.text,
        feelings: [],
        feelingNote: '',
      }),
    }
  }

  if (dashboard) {
    return {
      checkpoint: normalized,
      guidance: hereGuidanceSchema.parse({
        currentMicroStepId: 'here.focus',
        scores: dashboard.scores,
        feelings: [],
        feelingNote: '',
      }),
    }
  }

  return { checkpoint: normalized, guidance: emptyHereGuidance() }
}

export function migrateCheckpoint(raw: unknown, now: string): LifeDesignCheckpoint {
  const current = checkpointSchema.safeParse(raw)
  if (current.success) return current.data

  const v3 = checkpointV3Schema.safeParse(raw)
  if (v3.success) {
    return checkpointSchema.parse({
      ...v3.data,
      schemaVersion: 4,
      revision: v3.data.revision + 1,
      updatedAt: now,
      coachPendingAfter: null,
      coachTurns: [],
      blueprint: { status: 'idle' },
    })
  }

  const previous = checkpointV2Schema.safeParse(raw)
  if (previous.success) {
    const migratedHere = migrateV2Here(previous.data)
    return checkpointSchema.parse({
      ...migratedHere.checkpoint,
      schemaVersion: 4,
      revision: previous.data.revision + 1,
      updatedAt: now,
      hereGuidance: migratedHere.guidance,
      stageReflections: {},
      coachPendingAfter: null,
      coachTurns: [],
      blueprint: { status: 'idle' },
    })
  }

  const legacy = legacyCheckpointSchema.parse(raw)
  return checkpointSchema.parse({
    schemaVersion: 4,
    sessionId: legacy.sessionId,
    revision: legacy.revision + 1,
    createdAt: legacy.createdAt,
    updatedAt: now,
    stage: 'here',
    currentStepId: steps[0]?.id ?? null,
    completedStepIds: [],
    responses: [],
    pendingOperation: null,
    legacyNotes: legacy.answers.map((answer) => answer.text),
    hereGuidance: emptyHereGuidance(),
    stageReflections: {},
    coachPendingAfter: null,
    coachTurns: [],
    blueprint: { status: 'idle' },
  })
}

export function saveHereGuidance(
  checkpoint: LifeDesignCheckpoint,
  guidance: HereGuidance,
  now: string,
): LifeDesignCheckpoint {
  if (checkpoint.stage !== 'here' || !checkpoint.hereGuidance) {
    throw new Error('Guided first stage is not active')
  }

  const valid = hereGuidanceSchema.parse(guidance)
  const currentIndex = hereMicroStepOrder.indexOf(checkpoint.hereGuidance.currentMicroStepId)
  const nextIndex = hereMicroStepOrder.indexOf(valid.currentMicroStepId)
  if (nextIndex < currentIndex || nextIndex > currentIndex + 1) {
    throw new Error('Guided progress must advance one micro-step at a time')
  }

  return checkpointSchema.parse({
    ...checkpoint,
    revision: checkpoint.revision + 1,
    updatedAt: now,
    hereGuidance: valid,
  })
}

export function goBackHereGuidance(
  checkpoint: LifeDesignCheckpoint,
  now: string,
): LifeDesignCheckpoint {
  if (checkpoint.stage !== 'here' || !checkpoint.hereGuidance) {
    throw new Error('Guided first stage is not active')
  }
  const index = hereMicroStepOrder.indexOf(checkpoint.hereGuidance.currentMicroStepId)
  const previous = hereMicroStepOrder[Math.max(0, index - 1)]

  return checkpointSchema.parse({
    ...checkpoint,
    revision: checkpoint.revision + 1,
    updatedAt: now,
    hereGuidance: {
      ...checkpoint.hereGuidance,
      currentMicroStepId: previous,
    },
  })
}

export function completeHereGuidance(
  checkpoint: LifeDesignCheckpoint,
  reflection: string,
  now: string,
): LifeDesignCheckpoint {
  if (checkpoint.stage !== 'here' || !checkpoint.hereGuidance) {
    throw new Error('Guided first stage is not active')
  }

  const draft = hereGuidanceSchema.parse(checkpoint.hereGuidance)
  if (
    draft.currentMicroStepId !== 'here.summary' ||
    !draft.scores ||
    !draft.focus ||
    !draft.problemShapeId ||
    !draft.problemStatement ||
    !draft.momentWindow ||
    !draft.momentDetails ||
    draft.feelings.length === 0 ||
    !draft.boundaryType ||
    !draft.nextAction
  ) {
    throw new Error('Guided first-stage answers are incomplete')
  }
  buildHereReflection(draft)
  const editedReflection = reflection.trim()
  if (editedReflection.length < 10 || editedReflection.length > 3000) {
    throw new Error('Guided reflection is incomplete')
  }

  const hereResponses: LifeDesignResponse[] = [
    { stepId: 'here.dashboard', kind: 'dashboard', scores: draft.scores },
    {
      stepId: 'here.primary-problem',
      kind: 'text',
      text: draft.problemStatement,
    },
    {
      stepId: 'here.why-now',
      kind: 'text',
      text: `${draft.momentDetails} 当时我感到${draft.feelings.join('、')}。我愿意先做的是：${draft.nextAction}`,
    },
  ]

  return checkpointSchema.parse({
    ...checkpoint,
    revision: checkpoint.revision + 1,
    updatedAt: now,
    stage: 'compass',
    currentStepId: 'compass.workview',
    completedStepIds: Array.from(
      new Set([
        ...checkpoint.completedStepIds,
        'here.dashboard',
        'here.primary-problem',
        'here.why-now',
      ]),
    ),
    responses: [
      ...checkpoint.responses.filter((response) => !response.stepId.startsWith('here.')),
      ...hereResponses,
    ],
    pendingOperation: null,
    hereGuidance: null,
    stageReflections: { ...checkpoint.stageReflections, here: editedReflection },
    coachPendingAfter: 'here.guided',
  })
}

export function recordResponse(
  checkpoint: LifeDesignCheckpoint,
  response: LifeDesignResponse,
  now: string,
): LifeDesignCheckpoint {
  if (!checkpoint.currentStepId) throw new Error('Session is complete')
  if (checkpoint.pendingOperation) throw new Error('A saved response is waiting to advance')

  const validResponse = lifeDesignResponseSchema.parse(response)
  if (validResponse.stepId !== checkpoint.currentStepId) {
    throw new Error('Response does not match the current step')
  }

  return checkpointSchema.parse({
    ...checkpoint,
    revision: checkpoint.revision + 1,
    updatedAt: now,
    responses: [
      ...checkpoint.responses.filter((item) => item.stepId !== validResponse.stepId),
      validResponse,
    ],
    pendingOperation: {
      type: 'advance-step',
      stepId: checkpoint.currentStepId,
    },
    coachPendingAfter: checkpoint.currentStepId,
  })
}

export function recordCoachTurn(
  checkpoint: LifeDesignCheckpoint,
  draft: CoachTurnDraft,
  now: string,
): LifeDesignCheckpoint {
  if (!checkpoint.coachPendingAfter) throw new Error('No coaching moment is waiting')
  const valid = coachTurnDraftSchema.parse(draft)
  const anchor = checkpoint.coachPendingAfter
  const turn = {
    ...valid,
    id: `${checkpoint.sessionId}:${anchor}`,
    afterStepId: anchor,
    createdAt: now,
  }

  return checkpointSchema.parse({
    ...checkpoint,
    revision: checkpoint.revision + 1,
    updatedAt: now,
    coachTurns: [
      ...checkpoint.coachTurns.filter((item) => item.afterStepId !== anchor),
      turn,
    ],
  })
}

export function completeCoachMoment(
  checkpoint: LifeDesignCheckpoint,
  followUpAnswer: string | undefined,
  now: string,
): LifeDesignCheckpoint {
  const anchor = checkpoint.coachPendingAfter
  if (!anchor) throw new Error('No coaching moment is waiting')
  if (!checkpoint.coachTurns.some((item) => item.afterStepId === anchor)) {
    throw new Error('Coach response has not been saved')
  }
  const answer = followUpAnswer?.trim()
  const completed = checkpointSchema.parse({
    ...checkpoint,
    revision: checkpoint.revision + 1,
    updatedAt: now,
    coachPendingAfter: null,
    coachTurns: checkpoint.coachTurns.map((item) =>
      item.afterStepId === anchor
        ? { ...item, followUpAnswer: answer || undefined }
        : item,
    ),
  })

  return completed.pendingOperation
    ? advanceAfterSavedResponse(completed, now)
    : completed
}

export function skipCoachMoment(
  checkpoint: LifeDesignCheckpoint,
  now: string,
): LifeDesignCheckpoint {
  if (!checkpoint.coachPendingAfter) throw new Error('No coaching moment is waiting')
  const skipped = checkpointSchema.parse({
    ...checkpoint,
    revision: checkpoint.revision + 1,
    updatedAt: now,
    coachPendingAfter: null,
  })

  return skipped.pendingOperation ? advanceAfterSavedResponse(skipped, now) : skipped
}

export function beginBlueprint(
  checkpoint: LifeDesignCheckpoint,
  now: string,
): LifeDesignCheckpoint {
  if (checkpoint.stage !== 'complete' || checkpoint.currentStepId !== null) {
    throw new Error('Life design materials are incomplete')
  }
  return checkpointSchema.parse({
    ...checkpoint,
    revision: checkpoint.revision + 1,
    updatedAt: now,
    blueprint: {
      ...checkpoint.blueprint,
      status: 'generating',
      error: undefined,
    },
  })
}

export function completeBlueprint(
  checkpoint: LifeDesignCheckpoint,
  markdown: string,
  now: string,
): LifeDesignCheckpoint {
  if (checkpoint.blueprint.status !== 'generating') {
    throw new Error('Blueprint generation is not active')
  }
  return checkpointSchema.parse({
    ...checkpoint,
    revision: checkpoint.revision + 1,
    updatedAt: now,
    blueprint: {
      status: 'complete',
      markdown: markdown.trim(),
      generatedAt: now,
    },
  })
}

export function failBlueprint(
  checkpoint: LifeDesignCheckpoint,
  message: string,
  now: string,
): LifeDesignCheckpoint {
  return checkpointSchema.parse({
    ...checkpoint,
    revision: checkpoint.revision + 1,
    updatedAt: now,
    blueprint: {
      ...checkpoint.blueprint,
      status: 'failed',
      error: message.trim().slice(0, 300) || '蓝图生成失败',
    },
  })
}

export function recoverInterruptedBlueprint(
  checkpoint: LifeDesignCheckpoint,
  now: string,
): LifeDesignCheckpoint {
  return checkpoint.blueprint.status === 'generating'
    ? failBlueprint(checkpoint, '上次蓝图生成被中断，可以从这里重新生成。', now)
    : checkpoint
}

export function advanceAfterSavedResponse(
  checkpoint: LifeDesignCheckpoint,
  now: string,
): LifeDesignCheckpoint {
  if (!checkpoint.pendingOperation) {
    throw new Error('No saved response is waiting to advance')
  }

  const completedId = checkpoint.pendingOperation.stepId
  const index = steps.findIndex((step) => step.id === completedId)
  if (index < 0) throw new Error('Unknown completed step')
  const next = steps[index + 1] ?? null

  return checkpointSchema.parse({
    ...checkpoint,
    revision: checkpoint.revision + 1,
    updatedAt: now,
    stage: next?.stage ?? 'complete',
    currentStepId: next?.id ?? null,
    completedStepIds: Array.from(new Set([...checkpoint.completedStepIds, completedId])),
    pendingOperation: null,
    hereGuidance: next?.stage === 'here' ? checkpoint.hereGuidance : null,
  })
}

export function isReadyForBlueprint(checkpoint: LifeDesignCheckpoint): boolean {
  return (
    checkpoint.currentStepId === null &&
    checkpoint.pendingOperation === null &&
    checkpoint.completedStepIds.length === steps.length &&
    steps.every((step) => checkpoint.responses.some((response) => response.stepId === step.id))
  )
}
