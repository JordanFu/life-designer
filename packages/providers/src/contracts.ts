import { z } from 'zod'
import {
  checkpointSchema,
  coachAnchorSchema,
  coachTurnDraftSchema,
} from '@life-design/core'

export { coachTurnDraftSchema } from '@life-design/core'

export const coachRequestSchema = z.object({
  anchor: coachAnchorSchema,
  checkpoint: checkpointSchema,
})

export const blueprintRequestSchema = z.object({
  checkpoint: checkpointSchema,
})

export const blueprintDraftSchema = z.object({
  title: z.string().trim().min(2).max(100),
  markdown: z.string().trim().min(100).max(80_000),
})

export const coachOutputJsonSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['acknowledgement', 'insight', 'followUp'],
  properties: {
    acknowledgement: { type: 'string', minLength: 10, maxLength: 800 },
    insight: { type: 'string', minLength: 10, maxLength: 1000 },
    followUp: { type: 'string', minLength: 5, maxLength: 500 },
  },
} as const

export const blueprintOutputJsonSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['title', 'markdown'],
  properties: {
    title: { type: 'string', minLength: 2, maxLength: 100 },
    markdown: { type: 'string', minLength: 100, maxLength: 80_000 },
  },
} as const

export type CoachRequest = z.infer<typeof coachRequestSchema>
export type BlueprintRequest = z.infer<typeof blueprintRequestSchema>
export type CoachTurnDraft = z.infer<typeof coachTurnDraftSchema>
export type BlueprintDraft = z.infer<typeof blueprintDraftSchema>
