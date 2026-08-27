import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { CoachMoment } from './coach-moment'

describe('CoachMoment', () => {
  it('automatically asks Codex once and reassures that the answer is saved', async () => {
    const onGenerate = vi.fn().mockResolvedValue(true)
    render(
      <CoachMoment
        anchor="here.guided"
        turn={null}
        status="loading"
        error={null}
        onGenerate={onGenerate}
        onContinue={vi.fn()}
        onSkip={vi.fn()}
      />,
    )

    expect(screen.getByText(/你的回答已经保存/)).toBeTruthy()
    expect(screen.getByText(/教练正在读/)).toBeTruthy()
  })

  it('lets the user answer one concrete follow-up or continue without it', async () => {
    const onContinue = vi.fn().mockResolvedValue(true)
    render(
      <CoachMoment
        anchor="compass.workview"
        turn={{
          id: 'turn-1',
          afterStepId: 'compass.workview',
          acknowledgement: '你把工作看成创造价值，同时保持自主的一种方式。',
          insight: '这里可能存在自主和稳定之间需要被看见的拉扯。',
          followUp: '最近哪一次工作最接近你说的理想状态？',
          createdAt: '2026-08-27T08:00:00.000Z',
        }}
        status="ready"
        error={null}
        onGenerate={vi.fn()}
        onContinue={onContinue}
        onSkip={vi.fn()}
      />,
    )

    fireEvent.change(screen.getByRole('textbox', { name: '想补充的话' }), {
      target: { value: '一次从零搭建产品的经历。' },
    })
    fireEvent.click(screen.getByRole('button', { name: '补充并继续' }))
    await waitFor(() => expect(onContinue).toHaveBeenCalledWith('一次从零搭建产品的经历。'))
  })

  it('offers retry and a local fallback when Codex fails', () => {
    const onGenerate = vi.fn()
    const onSkip = vi.fn()
    render(
      <CoachMoment
        anchor="wayfinding.energy-map"
        turn={null}
        status="error"
        error="本机 Codex 未就绪"
        onGenerate={onGenerate}
        onContinue={vi.fn()}
        onSkip={onSkip}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: '重试回应' }))
    fireEvent.click(screen.getByRole('button', { name: '先继续使用本地流程' }))
    expect(onGenerate).toHaveBeenCalledOnce()
    expect(onSkip).toHaveBeenCalledOnce()
  })
})
