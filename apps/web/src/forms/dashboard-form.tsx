'use client'

import type { FormEvent } from 'react'
import { useState } from 'react'
import type { DashboardResponse } from '@life-design/core'

type Scores = DashboardResponse['scores']

const dimensions: Array<{ key: keyof Scores; label: string; note: string }> = [
  { key: 'health', label: '健康', note: '身体、情绪与心理状态' },
  { key: 'work', label: '工作', note: '职业、学习与贡献感' },
  { key: 'play', label: '娱乐', note: '纯粹为了快乐做的事' },
  { key: 'love', label: '爱', note: '家人、伴侣、朋友与连接' },
]

export function DashboardForm({
  disabled,
  onSubmit,
}: {
  disabled: boolean
  onSubmit(response: DashboardResponse): Promise<void>
}) {
  const [scores, setScores] = useState<Scores>({ health: 5, work: 5, play: 5, love: 5 })

  async function submit(event: FormEvent) {
    event.preventDefault()
    await onSubmit({ stepId: 'here.dashboard', kind: 'dashboard', scores })
  }

  return (
    <form className="step-form" onSubmit={submit}>
      <div className="score-grid">
        {dimensions.map((dimension) => (
          <label className="score-row" key={dimension.key}>
            <span>
              <strong>{dimension.label}</strong>
              <small>{dimension.note}</small>
            </span>
            <input
              aria-label={dimension.label}
              type="range"
              min="0"
              max="10"
              value={scores[dimension.key]}
              disabled={disabled}
              onChange={(event) =>
                setScores((current) => ({
                  ...current,
                  [dimension.key]: Number(event.target.value),
                }))
              }
            />
            <output>{scores[dimension.key]}</output>
          </label>
        ))}
      </div>
      <button disabled={disabled}>保存并继续</button>
    </form>
  )
}
