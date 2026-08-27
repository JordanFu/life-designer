import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { BlueprintView } from './blueprint-view'

const markdown = `# 我的人生设计蓝图

## 你在这里

你正在重新寻找工作、能量与生活之间更真实的关系。

## 真问题

真正值得验证的是下一种工作日常，而不是立刻找到终身答案。

${'这是一段来自真实素材的补充内容。'.repeat(8)}`

describe('BlueprintView', () => {
  it('starts an honest blueprint generation from complete materials', () => {
    const onGenerate = vi.fn()
    render(
      <BlueprintView
        blueprint={{ status: 'idle' }}
        onGenerate={onGenerate}
        onDownload={vi.fn()}
        onPrint={vi.fn()}
        onExportMaterials={vi.fn()}
      />,
    )

    expect(screen.getByText(/四阶段素材已经齐全/)).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: '生成我的人生设计蓝图' }))
    expect(onGenerate).toHaveBeenCalledOnce()
  })

  it('renders saved markdown without unsafe HTML and offers all exports', () => {
    const onDownload = vi.fn()
    const onPrint = vi.fn()
    render(
      <BlueprintView
        blueprint={{
          status: 'complete',
          markdown,
          generatedAt: '2026-08-27T08:00:00.000Z',
        }}
        onGenerate={vi.fn()}
        onDownload={onDownload}
        onPrint={onPrint}
        onExportMaterials={vi.fn()}
      />,
    )

    expect(screen.getByRole('heading', { name: '我的人生设计蓝图' })).toBeTruthy()
    expect(screen.getByRole('heading', { name: '你在这里' })).toBeTruthy()
    expect(document.querySelector('script')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: '下载 Markdown' }))
    fireEvent.click(screen.getByRole('button', { name: '打印或保存 PDF' }))
    expect(onDownload).toHaveBeenCalledOnce()
    expect(onPrint).toHaveBeenCalledOnce()
  })

  it('keeps an old blueprint visible when regeneration fails', () => {
    const onGenerate = vi.fn()
    render(
      <BlueprintView
        blueprint={{ status: 'failed', markdown, error: '本地 Codex 暂时不可用' }}
        onGenerate={onGenerate}
        onDownload={vi.fn()}
        onPrint={vi.fn()}
        onExportMaterials={vi.fn()}
      />,
    )

    expect(screen.getByText('本地 Codex 暂时不可用')).toBeTruthy()
    expect(screen.getByRole('heading', { name: '我的人生设计蓝图' })).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: '重新生成' }))
    expect(onGenerate).toHaveBeenCalledOnce()
  })
})
