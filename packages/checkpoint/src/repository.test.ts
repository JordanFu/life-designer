import 'fake-indexeddb/auto'
import { afterEach, describe, expect, it } from 'vitest'
import { createCheckpoint } from '@life-design/core'
import { CheckpointRepository } from './repository'

describe('CheckpointRepository', () => {
  const repositories: CheckpointRepository[] = []

  afterEach(async () => {
    for (const repository of repositories) {
      await repository.deleteDatabase()
    }
    repositories.length = 0
  })

  it('loads the most recently saved checkpoint after reopening', async () => {
    const first = new CheckpointRepository('restore-test')
    const checkpoint = createCheckpoint('session-1', '2026-08-27T08:00:00.000Z')
    await first.save(checkpoint)
    first.close()

    const reopened = new CheckpointRepository('restore-test')
    repositories.push(reopened)
    expect(await reopened.load('session-1')).toEqual(checkpoint)
  })

  it('rejects a stale revision instead of overwriting newer data', async () => {
    const repository = new CheckpointRepository('revision-test')
    repositories.push(repository)
    const revisionOne = createCheckpoint('session-1', '2026-08-27T08:00:00.000Z')
    await repository.save({ ...revisionOne, revision: 2 })
    await expect(repository.save(revisionOne)).rejects.toThrow('Stale checkpoint revision')
  })

  it('migrates a persisted Stage 0 checkpoint without treating it as complete', async () => {
    const repository = new CheckpointRepository('migration-test')
    repositories.push(repository)
    await repository.checkpoints.put({
      schemaVersion: 1,
      sessionId: 'legacy-session',
      revision: 7,
      createdAt: '2026-08-27T08:00:00.000Z',
      updatedAt: '2026-08-27T08:03:00.000Z',
      stage: 'here',
      currentQuestionId: null,
      completedQuestionIds: ['here.dashboard', 'here.primary-problem', 'here.why-now'],
      answers: [
        {
          questionId: 'here.primary-problem',
          text: '工作让我焦虑。',
          answeredAt: '2026-08-27T08:02:00.000Z',
        },
      ],
      pendingOperation: null,
    } as never)

    const migrated = await repository.load('legacy-session')
    expect(migrated).toMatchObject({
      schemaVersion: 2,
      currentStepId: 'here.dashboard',
      legacyNotes: ['工作让我焦虑。'],
    })
    expect(await repository.checkpoints.get('legacy-session')).toMatchObject({ schemaVersion: 2 })
  })
})
