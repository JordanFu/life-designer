import {
  checkpointSchema,
  type LifeDesignCheckpoint,
  type QuestionId,
} from './checkpoint'

export const questions: ReadonlyArray<{ id: QuestionId; text: string }> = [
  {
    id: 'here.dashboard',
    text: '如果给健康、工作、娱乐和爱各打 0 到 10 分，你会怎么打？哪一项最亮红灯？',
  },
  {
    id: 'here.primary-problem',
    text: '此刻你最想解决、也最让你焦虑的那个人生问题是什么？',
  },
  {
    id: 'here.why-now',
    text: '最近哪一件具体的事，让这个问题变得不能再忽略？',
  },
]

export function createCheckpoint(sessionId: string, now: string): LifeDesignCheckpoint {
  return checkpointSchema.parse({
    schemaVersion: 1,
    sessionId,
    revision: 1,
    createdAt: now,
    updatedAt: now,
    stage: 'here',
    currentQuestionId: questions[0]?.id ?? null,
    completedQuestionIds: [],
    answers: [],
    pendingOperation: null,
  })
}

export function recordAnswer(
  checkpoint: LifeDesignCheckpoint,
  text: string,
  now: string,
): LifeDesignCheckpoint {
  if (!checkpoint.currentQuestionId) throw new Error('Session is complete')
  return checkpointSchema.parse({
    ...checkpoint,
    revision: checkpoint.revision + 1,
    updatedAt: now,
    answers: [
      ...checkpoint.answers,
      { questionId: checkpoint.currentQuestionId, text, answeredAt: now },
    ],
    pendingOperation: {
      type: 'advance-question',
      questionId: checkpoint.currentQuestionId,
    },
  })
}

export function advanceAfterSavedAnswer(
  checkpoint: LifeDesignCheckpoint,
  now: string,
): LifeDesignCheckpoint {
  if (!checkpoint.pendingOperation) {
    throw new Error('No saved answer is waiting to advance')
  }
  const completedId = checkpoint.pendingOperation.questionId
  const index = questions.findIndex((question) => question.id === completedId)
  return checkpointSchema.parse({
    ...checkpoint,
    revision: checkpoint.revision + 1,
    updatedAt: now,
    currentQuestionId: questions[index + 1]?.id ?? null,
    completedQuestionIds: [...checkpoint.completedQuestionIds, completedId],
    pendingOperation: null,
  })
}
