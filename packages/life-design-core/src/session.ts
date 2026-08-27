import {
  checkpointSchema,
  legacyCheckpointSchema,
  lifeDesignResponseSchema,
  type LifeDesignCheckpoint,
  type LifeDesignResponse,
} from './checkpoint'
import { steps } from './steps'

export function createCheckpoint(sessionId: string, now: string): LifeDesignCheckpoint {
  return checkpointSchema.parse({
    schemaVersion: 2,
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
  })
}

export function migrateCheckpoint(raw: unknown, now: string): LifeDesignCheckpoint {
  const current = checkpointSchema.safeParse(raw)
  if (current.success) return current.data

  const legacy = legacyCheckpointSchema.parse(raw)
  return checkpointSchema.parse({
    schemaVersion: 2,
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
