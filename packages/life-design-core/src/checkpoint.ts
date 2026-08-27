import { z } from 'zod'

export const questionIdSchema = z.enum([
  'here.dashboard',
  'here.primary-problem',
  'here.why-now',
])

export const answerSchema = z.object({
  questionId: questionIdSchema,
  text: z.string().trim().min(1),
  answeredAt: z.string().datetime(),
})

export const checkpointSchema = z.object({
  schemaVersion: z.literal(1),
  sessionId: z.string().min(1),
  revision: z.number().int().positive(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  stage: z.literal('here'),
  currentQuestionId: questionIdSchema.nullable(),
  completedQuestionIds: z.array(questionIdSchema),
  answers: z.array(answerSchema),
  pendingOperation: z
    .object({ type: z.literal('advance-question'), questionId: questionIdSchema })
    .nullable(),
})

export type QuestionId = z.infer<typeof questionIdSchema>
export type LifeDesignCheckpoint = z.infer<typeof checkpointSchema>
