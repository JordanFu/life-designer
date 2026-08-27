import { afterEach, describe, expect, it, vi } from 'vitest'
import { createCheckpoint } from '@life-design/core'
import { requestBlueprint, requestCoach } from './local-codex-api'

const checkpoint = createCheckpoint('web-api-test', '2026-08-27T08:00:00.000Z')

afterEach(() => vi.unstubAllGlobals())

describe('local Codex browser client', () => {
  it('validates a successful coach response', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            acknowledgement: '你没有急着给自己答案，而是先承认了当下真实的位置。',
            insight: '这可能说明你已经准备好把模糊困扰拆成可以观察的线索。',
            followUp: '最近哪一个具体时刻最能代表这种困扰？',
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        ),
      ),
    )

    const result = await requestCoach({ anchor: 'here.guided', checkpoint })

    expect(result.followUp).toContain('具体时刻')
    expect(fetch).toHaveBeenCalledWith(
      '/api/codex/coach',
      expect.objectContaining({ method: 'POST' }),
    )
  })

  it('surfaces a concise server error without echoing private checkpoint content', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ error: '本地 Codex 未启用' }), {
          status: 503,
          headers: { 'Content-Type': 'application/json' },
        }),
      ),
    )

    await expect(requestCoach({ anchor: 'here.guided', checkpoint })).rejects.toThrow(
      '本地 Codex 未启用',
    )
  })

  it('rejects an incomplete blueprint response', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ title: '蓝图' }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      ),
    )

    await expect(requestBlueprint({ checkpoint })).rejects.toThrow('模型返回内容不完整')
  })
})
