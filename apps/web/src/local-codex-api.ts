import {
  blueprintDraftSchema,
  coachTurnDraftSchema,
  type BlueprintDraft,
  type BlueprintRequest,
  type CoachRequest,
  type CoachTurnDraft,
} from '@life-design/providers/contracts'

async function postJson(path: string, input: unknown): Promise<unknown> {
  const response = await fetch(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })
  let payload: unknown
  try {
    payload = await response.json()
  } catch {
    throw new Error('本地模型服务返回了无法读取的内容')
  }
  if (!response.ok) {
    const message =
      typeof payload === 'object' && payload && 'error' in payload && typeof payload.error === 'string'
        ? payload.error
        : '本地 Codex 暂时不可用'
    throw new Error(message.slice(0, 300))
  }
  return payload
}

export async function requestCoach(input: CoachRequest): Promise<CoachTurnDraft> {
  const parsed = coachTurnDraftSchema.safeParse(await postJson('/api/codex/coach', input))
  if (!parsed.success) throw new Error('模型返回内容不完整')
  return parsed.data
}

export async function requestBlueprint(input: BlueprintRequest): Promise<BlueprintDraft> {
  const parsed = blueprintDraftSchema.safeParse(await postJson('/api/codex/blueprint', input))
  if (!parsed.success) throw new Error('模型返回内容不完整')
  return parsed.data
}
