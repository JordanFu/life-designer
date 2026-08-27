import { z } from 'zod'

export const stageSchema = z.enum(['here', 'compass', 'wayfinding', 'odyssey', 'complete'])

export const stepIdSchema = z.enum([
  'here.dashboard',
  'here.primary-problem',
  'here.why-now',
  'compass.workview',
  'compass.lifeview',
  'wayfinding.energy-map',
  'odyssey.plans',
  'odyssey.prototype',
])

const scoreSchema = z.number().int().min(0).max(10)

export const dashboardResponseSchema = z.object({
  stepId: z.literal('here.dashboard'),
  kind: z.literal('dashboard'),
  scores: z.object({
    health: scoreSchema,
    work: scoreSchema,
    play: scoreSchema,
    love: scoreSchema,
  }),
})

export const textResponseSchema = z.object({
  stepId: z.enum([
    'here.primary-problem',
    'here.why-now',
    'compass.workview',
    'compass.lifeview',
  ]),
  kind: z.literal('text'),
  text: z.string().trim().min(2).max(4000),
})

export const energyMapResponseSchema = z.object({
  stepId: z.literal('wayfinding.energy-map'),
  kind: z.literal('energy-map'),
  events: z
    .array(
      z.object({
        activity: z.string().trim().min(2).max(300),
        energy: z.enum(['drain', 'neutral', 'gain']),
        engagement: z.number().int().min(1).max(5),
      }),
    )
    .length(3),
})

export const odysseyPlanSchema = z.object({
  title: z.string().trim().min(2).max(80),
  summary: z.string().trim().min(5).max(1000),
  workMilestone: z.string().trim().min(2).max(300),
  personalMilestone: z.string().trim().min(2).max(300),
  resources: scoreSchema,
  excitement: scoreSchema,
  confidence: scoreSchema,
  coherence: scoreSchema,
})

export const odysseyPlansResponseSchema = z.object({
  stepId: z.literal('odyssey.plans'),
  kind: z.literal('odyssey-plans'),
  plans: z.array(odysseyPlanSchema).length(3),
})

export const prototypeResponseSchema = z.object({
  stepId: z.literal('odyssey.prototype'),
  kind: z.literal('prototype'),
  planIndex: z.number().int().min(0).max(2),
  experimentType: z.enum(['conversation', 'experience', 'artifact']),
  action: z.string().trim().min(3).max(500),
  timing: z.string().trim().min(2).max(120),
})

export const lifeDesignResponseSchema = z.discriminatedUnion('kind', [
  dashboardResponseSchema,
  textResponseSchema,
  energyMapResponseSchema,
  odysseyPlansResponseSchema,
  prototypeResponseSchema,
])

export const checkpointSchema = z.object({
  schemaVersion: z.literal(2),
  sessionId: z.string().min(1),
  revision: z.number().int().positive(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  stage: stageSchema,
  currentStepId: stepIdSchema.nullable(),
  completedStepIds: z.array(stepIdSchema),
  responses: z.array(lifeDesignResponseSchema),
  pendingOperation: z
    .object({ type: z.literal('advance-step'), stepId: stepIdSchema })
    .nullable(),
  legacyNotes: z.array(z.string()).default([]),
})

const legacyQuestionIdSchema = z.enum([
  'here.dashboard',
  'here.primary-problem',
  'here.why-now',
])

export const legacyCheckpointSchema = z.object({
  schemaVersion: z.literal(1),
  sessionId: z.string().min(1),
  revision: z.number().int().positive(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  stage: z.literal('here'),
  currentQuestionId: legacyQuestionIdSchema.nullable(),
  completedQuestionIds: z.array(legacyQuestionIdSchema),
  answers: z.array(
    z.object({
      questionId: legacyQuestionIdSchema,
      text: z.string().min(1),
      answeredAt: z.string().datetime(),
    }),
  ),
  pendingOperation: z
    .object({ type: z.literal('advance-question'), questionId: legacyQuestionIdSchema })
    .nullable(),
})

export type LifeDesignStage = z.infer<typeof stageSchema>
export type StepId = z.infer<typeof stepIdSchema>
export type LifeDesignResponse = z.infer<typeof lifeDesignResponseSchema>
export type DashboardResponse = z.infer<typeof dashboardResponseSchema>
export type TextResponse = z.infer<typeof textResponseSchema>
export type EnergyMapResponse = z.infer<typeof energyMapResponseSchema>
export type OdysseyPlansResponse = z.infer<typeof odysseyPlansResponseSchema>
export type PrototypeResponse = z.infer<typeof prototypeResponseSchema>
export type OdysseyPlan = z.infer<typeof odysseyPlanSchema>
export type LifeDesignCheckpoint = z.infer<typeof checkpointSchema>
export type LegacyCheckpoint = z.infer<typeof legacyCheckpointSchema>
