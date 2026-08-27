import 'fake-indexeddb/auto'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { CheckpointRepository } from '@life-design/checkpoint'
import { LifeDesignSession } from './life-design-session'

describe('LifeDesignSession', () => {
  afterEach(async () => {
    localStorage.clear()
    await new CheckpointRepository().deleteDatabase()
  })

  it('starts an eight-step journey and hides completion actions', async () => {
    const view = render(<LifeDesignSession />)
    await screen.findByText('第 1 步，共 8 步')
    expect(screen.queryByRole('button', { name: '导出人生设计素材' })).toBeNull()

    fireEvent.click(screen.getByRole('button', { name: '保存并继续' }))
    await waitFor(() => expect(screen.getByText('第 2 步，共 8 步')).toBeTruthy())
    expect(screen.getByRole('heading', { name: '此刻最想解决的问题' })).toBeTruthy()
    expect(screen.queryByRole('button', { name: '导出人生设计素材' })).toBeNull()
    view.unmount()
  })
})
