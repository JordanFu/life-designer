import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { getStep } from '@life-design/core'
import { StepForm } from './step-form'

function renderStep(stepId: Parameters<typeof getStep>[0]) {
  const onSubmit = vi.fn().mockResolvedValue(undefined)
  const step = getStep(stepId)
  if (!step) throw new Error(`Missing step: ${stepId}`)
  render(<StepForm step={step} disabled={false} onSubmit={onSubmit} />)
  return onSubmit
}

describe('StepForm', () => {
  it('submits four numeric dashboard scores', async () => {
    const onSubmit = renderStep('here.dashboard')
    fireEvent.change(screen.getByLabelText('工作'), { target: { value: '3' } })
    fireEvent.click(screen.getByRole('button', { name: '保存并继续' }))
    await waitFor(() =>
      expect(onSubmit).toHaveBeenCalledWith({
        stepId: 'here.dashboard',
        kind: 'dashboard',
        scores: { health: 5, work: 3, play: 5, love: 5 },
      }),
    )
  })

  it('trims a guided text response', async () => {
    const onSubmit = renderStep('compass.workview')
    fireEvent.change(screen.getByLabelText('你的回答'), {
      target: { value: '  工作意味着创造和经济自主。  ' },
    })
    fireEvent.click(screen.getByRole('button', { name: '保存并继续' }))
    await waitFor(() =>
      expect(onSubmit).toHaveBeenCalledWith({
        stepId: 'compass.workview',
        kind: 'text',
        text: '工作意味着创造和经济自主。',
      }),
    )
  })

  it('requires three energy events', () => {
    renderStep('wayfinding.energy-map')
    const button = screen.getByRole('button', { name: '保存并继续' })
    expect((button as HTMLButtonElement).disabled).toBe(true)
    for (const index of [1, 2, 3]) {
      fireEvent.change(screen.getByLabelText(`活动 ${index}`), {
        target: { value: `具体活动 ${index}` },
      })
    }
    expect((button as HTMLButtonElement).disabled).toBe(false)
  })

  it('submits three equally structured Odyssey plans', async () => {
    const onSubmit = renderStep('odyssey.plans')
    for (const index of [1, 2, 3]) {
      fireEvent.change(screen.getByLabelText(`方案 ${index} 标题`), {
        target: { value: `人生版本 ${index}` },
      })
      fireEvent.change(screen.getByLabelText(`方案 ${index} 理想画面`), {
        target: { value: `这是第 ${index} 个真实想尝试的五年生活画面。` },
      })
      fireEvent.change(screen.getByLabelText(`方案 ${index} 工作里程碑`), {
        target: { value: `工作里程碑 ${index}` },
      })
      fireEvent.change(screen.getByLabelText(`方案 ${index} 个人里程碑`), {
        target: { value: `个人里程碑 ${index}` },
      })
    }
    fireEvent.click(screen.getByRole('button', { name: '保存并继续' }))
    await waitFor(() => expect(onSubmit.mock.calls[0]?.[0].plans).toHaveLength(3))
    expect(onSubmit.mock.calls[0]?.[0].plans[2]).toMatchObject({
      title: '人生版本 3',
      resources: 5,
      excitement: 5,
      confidence: 5,
      coherence: 5,
    })
  })

  it('submits a low-cost prototype choice', async () => {
    const onSubmit = renderStep('odyssey.prototype')
    fireEvent.click(screen.getByLabelText('方案 2'))
    fireEvent.click(screen.getByLabelText('体验实验'))
    fireEvent.change(screen.getByLabelText('具体行动'), {
      target: { value: '跟随一位从业者体验半天真实工作。' },
    })
    fireEvent.change(screen.getByLabelText('计划时间'), {
      target: { value: '本月第二个周六' },
    })
    fireEvent.click(screen.getByRole('button', { name: '保存并继续' }))
    await waitFor(() =>
      expect(onSubmit).toHaveBeenCalledWith({
        stepId: 'odyssey.prototype',
        kind: 'prototype',
        planIndex: 1,
        experimentType: 'experience',
        action: '跟随一位从业者体验半天真实工作。',
        timing: '本月第二个周六',
      }),
    )
  })
})
