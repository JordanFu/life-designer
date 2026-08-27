import {
  checkpointSchema,
  checkpointV2Schema,
  hereGuidanceSchema,
  legacyCheckpointSchema,
  lifeDesignResponseSchema,
  type DashboardResponse,
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
    schemaVersion: 3,
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

  const previous = checkpointV2Schema.safeParse(raw)
  if (previous.success) {
    const migratedHere = migrateV2Here(previous.data)
    return checkpointSchema.parse({
      ...migratedHere.checkpoint,
      schemaVersion: 3,
      revision: previous.data.revision + 1,
      updatedAt: now,
      hereGuidance: migratedHere.guidance,
      stageReflections: {},
    })
  }

  const legacy = legacyCheckpointSchema.parse(raw)
  return checkpointSchema.parse({
    schemaVersion: 3,
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
  })
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
