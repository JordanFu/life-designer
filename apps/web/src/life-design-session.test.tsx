import 'fake-indexeddb/auto'
import { fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { CheckpointRepository } from '@life-design/checkpoint'
import { LifeDesignSession } from './life-design-session'

describe('LifeDesignSession', () => {
  afterEach(async () => {
    localStorage.clear()
    await new CheckpointRepository().deleteDatabase()
  })

  it('starts with reassurance and no abstract blank text field', async () => {
    const view = render(<LifeDesignSession />)

    expect(await screen.findByRole('heading', { name: '先不用想清楚答案' })).toBeTruthy()
    expect(screen.getByText('第一阶段：看清现在')).toBeTruthy()
    expect(screen.getByRole('progressbar', { name: '第一阶段进度' }).getAttribute('aria-valuenow')).toBe('1')
    expect(screen.queryByRole('textbox')).toBeNull()
    expect(screen.getByRole('button', { name: '开始看看' })).toBeTruthy()
    expect(screen.queryByRole('button', { name: '导出人生设计素材' })).toBeNull()
    view.unmount()
  })

  it('uses anchored choices, recommends a focus, and preserves answers when going back', async () => {
    const view = render(<LifeDesignSession />)
    await screen.findByRole('heading', { name: '先不用想清楚答案' })
    fireEvent.click(screen.getByRole('button', { name: '开始看看' }))

    expect(await screen.findByRole('heading', { name: '四个方面，先凭直觉看一眼' })).toBeTruthy()
    expect(screen.getAllByText('勉强维持，需要关注').length).toBeGreaterThan(0)
    fireEvent.change(screen.getByRole('slider', { name: '工作' }), { target: { value: '2' } })
    fireEvent.change(screen.getByRole('slider', { name: '健康' }), { target: { value: '7' } })
    fireEvent.click(screen.getByRole('button', { name: '看看哪里值得先聊' }))

    expect(await screen.findByRole('heading', { name: '这次先谈哪一个？' })).toBeTruthy()
    expect(screen.getByRole('button', { name: /工作.*建议先看/ })).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: /工作.*建议先看/ }))

    expect(await screen.findByRole('heading', { name: '哪句话更像你的困扰？' })).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: /想换方向但不知道去哪/ }))
    const statement = screen.getByRole('textbox', { name: '把困扰说成一句自己的话' })
    expect((statement as HTMLTextAreaElement).value).toContain('想换方向')
    fireEvent.click(screen.getByRole('button', { name: '继续，找一个真实时刻' }))

    expect(await screen.findByRole('heading', { name: '最近什么时候最明显？' })).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: /^这周/ }))
    expect(await screen.findByRole('heading', { name: '当时具体发生了什么？' })).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: '返回上一步' }))
    await screen.findByRole('heading', { name: '最近什么时候最明显？' })
    fireEvent.click(screen.getByRole('button', { name: '返回上一步' }))
    await screen.findByRole('heading', { name: '哪句话更像你的困扰？' })
    expect(
      (screen.getByRole('textbox', { name: '把困扰说成一句自己的话' }) as HTMLTextAreaElement)
        .value,
    ).toContain('想换方向')
    view.unmount()
  })
})
