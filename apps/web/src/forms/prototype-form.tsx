'use client'

import type { FormEvent } from 'react'
import { useState } from 'react'
import type { PrototypeResponse } from '@life-design/core'

const experiments: Array<{
  value: PrototypeResponse['experimentType']
  label: string
  note: string
}> = [
  { value: 'conversation', label: '人生设计访谈', note: '找一个正在过这种生活的人聊真实日常' },
  { value: 'experience', label: '体验实验', note: '安排半天到一周的小型真实体验' },
  { value: 'artifact', label: '小作品', note: '做出一个可以被看见或使用的最小作品' },
]

export function PrototypeForm({
  disabled,
  onSubmit,
}: {
  disabled: boolean
  onSubmit(response: PrototypeResponse): Promise<void>
}) {
  const [planIndex, setPlanIndex] = useState(0)
  const [experimentType, setExperimentType] =
    useState<PrototypeResponse['experimentType']>('conversation')
  const [action, setAction] = useState('')
  const [timing, setTiming] = useState('')
  const complete = action.trim().length >= 3 && timing.trim().length >= 2

  async function submit(event: FormEvent) {
    event.preventDefault()
    if (!complete) return
    await onSubmit({
      stepId: 'odyssey.prototype',
      kind: 'prototype',
      planIndex,
      experimentType,
      action: action.trim(),
      timing: timing.trim(),
    })
  }

  return (
    <form className="step-form" onSubmit={submit}>
      <fieldset className="choice-fieldset">
        <legend>先验证哪一个版本？</legend>
        <div className="choice-grid three">
          {[0, 1, 2].map((index) => (
            <label className="choice-card" key={index}>
              <input
                type="radio"
                name="plan"
                aria-label={`方案 ${index + 1}`}
                checked={planIndex === index}
                disabled={disabled}
                onChange={() => setPlanIndex(index)}
              />
              <strong>方案 {index + 1}</strong>
            </label>
          ))}
        </div>
      </fieldset>
      <fieldset className="choice-fieldset">
        <legend>选择一种低成本验证方式</legend>
        <div className="choice-grid">
          {experiments.map((experiment) => (
            <label className="choice-card" key={experiment.value}>
              <input
                type="radio"
                name="experiment"
                aria-label={experiment.label}
                checked={experimentType === experiment.value}
                disabled={disabled}
                onChange={() => setExperimentType(experiment.value)}
              />
              <strong>{experiment.label}</strong>
              <small>{experiment.note}</small>
            </label>
          ))}
        </div>
      </fieldset>
      <label className="field-stack">
        <span>具体行动</span>
        <textarea
          aria-label="具体行动"
          value={action}
          disabled={disabled}
          onChange={(event) => setAction(event.target.value)}
          rows={4}
        />
      </label>
      <label className="field-stack">
        <span>计划时间</span>
        <input
          aria-label="计划时间"
          value={timing}
          disabled={disabled}
          onChange={(event) => setTiming(event.target.value)}
          placeholder="例如：本月第二个周六"
        />
      </label>
      <button disabled={disabled || !complete}>保存并继续</button>
    </form>
  )
}
