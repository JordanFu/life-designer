import { describe, expect, it, vi } from 'vitest'
import { createCheckpoint } from '@life-design/core'
import { createCodexCliProvider, type CodexExecutor } from './codex-cli'

const now = '2026-08-27T08:00:00.000Z'
const checkpoint = createCheckpoint('provider-test', now)

describe('local Codex CLI provider', () => {
  it('passes a bounded prompt on stdin and requests ephemeral read-only structured output', async () => {
    const executor = vi.fn<CodexExecutor>().mockResolvedValue(
      JSON.stringify({
        acknowledgement: '你愿意先从真实处境出发，而不是逼自己立刻找到标准答案。',
        insight: '这里可能值得留意的是，你已经在把模糊感受变成可以观察的线索。',
        followUp: '最近哪一个具体时刻最能代表这种感受？',
      }),
    )
    const provider = createCodexCliProvider({ executor })

    const result = await provider.coach({ anchor: 'here.guided', checkpoint })

    expect(result.followUp).toContain('具体时刻')
    expect(executor).toHaveBeenCalledOnce()
    const call = executor.mock.calls[0]?.[0]
    expect(call?.stdin).toContain('人生设计教练')
    expect(call?.stdin).toContain('provider-test')
    expect(call?.args).toEqual(
      expect.arrayContaining([
        'exec',
        '--ephemeral',
        '--ignore-user-config',
        '--ignore-rules',
        '--sandbox',
        'read-only',
        '--skip-git-repo-check',
        '--output-schema',
      ]),
    )
  })

  it('rejects unreadable or schema-invalid model output with a safe public error', async () => {
    const unreadable = createCodexCliProvider({
      executor: vi.fn<CodexExecutor>().mockResolvedValue('not json'),
    })
    await expect(unreadable.coach({ anchor: 'here.guided', checkpoint })).rejects.toThrow(
      'Codex 返回了无法读取的内容',
    )

    const invalid = createCodexCliProvider({
      executor: vi.fn<CodexExecutor>().mockResolvedValue(JSON.stringify({ followUp: '太短' })),
    })
    await expect(invalid.coach({ anchor: 'here.guided', checkpoint })).rejects.toThrow(
      'Codex 回应缺少必要内容',
    )
  })

  it('builds an evidence-only seven-section blueprint request', async () => {
    const markdown = `# 我的人生设计蓝图\n\n${'基于用户真实素材形成的内容。'.repeat(20)}`
    const executor = vi.fn<CodexExecutor>().mockResolvedValue(
      JSON.stringify({ title: '我的人生设计蓝图', markdown }),
    )
    const provider = createCodexCliProvider({ executor })

    const result = await provider.blueprint({ checkpoint })

    expect(result.markdown).toBe(markdown)
    const prompt = executor.mock.calls[0]?.[0].stdin ?? ''
    expect(prompt).toContain('三个平等的五年版本')
    expect(prompt).toContain('不得虚构')
    expect(prompt).toContain('失败免疫')
  })
})
