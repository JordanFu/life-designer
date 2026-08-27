'use client'

import type { FormEvent } from 'react'
import { useState } from 'react'
import type { OdysseyPlan, OdysseyPlansResponse } from '@life-design/core'

const emptyPlan = (): OdysseyPlan => ({
  title: '',
  summary: '',
  workMilestone: '',
  personalMilestone: '',
  resources: 5,
  excitement: 5,
  confidence: 5,
  coherence: 5,
})

const ratings: Array<{ key: 'resources' | 'excitement' | 'confidence' | 'coherence'; label: string }> = [
  { key: 'resources', label: '资源可行性' },
  { key: 'excitement', label: '喜欢程度' },
  { key: 'confidence', label: '自信心' },
  { key: 'coherence', label: '一致性' },
]

export function OdysseyPlansForm({
  disabled,
  onSubmit,
}: {
  disabled: boolean
  onSubmit(response: OdysseyPlansResponse): Promise<void>
}) {
  const [plans, setPlans] = useState<OdysseyPlansResponse['plans']>([
    emptyPlan(),
    emptyPlan(),
    emptyPlan(),
  ])
  const complete = plans.every(
    (plan) =>
      plan.title.trim().length >= 2 &&
      plan.summary.trim().length >= 5 &&
      plan.workMilestone.trim().length >= 2 &&
      plan.personalMilestone.trim().length >= 2,
  )

  function update(index: number, patch: Partial<OdysseyPlan>) {
    setPlans((current) =>
      current.map((plan, planIndex) => (planIndex === index ? { ...plan, ...patch } : plan)) as
        OdysseyPlansResponse['plans'],
    )
  }

  async function submit(event: FormEvent) {
    event.preventDefault()
    if (!complete) return
    await onSubmit({
      stepId: 'odyssey.plans',
      kind: 'odyssey-plans',
      plans: plans.map((plan) => ({
        ...plan,
        title: plan.title.trim(),
        summary: plan.summary.trim(),
        workMilestone: plan.workMilestone.trim(),
        personalMilestone: plan.personalMilestone.trim(),
      })) as OdysseyPlansResponse['plans'],
    })
  }

  return (
    <form className="step-form" onSubmit={submit}>
      <div className="plan-grid">
        {plans.map((plan, index) => (
          <fieldset className="plan-card" key={index}>
            <legend>方案 {index + 1} · A 计划</legend>
            <label className="field-stack">
              <span>六字标题</span>
              <input
                aria-label={`方案 ${index + 1} 标题`}
                value={plan.title}
                disabled={disabled}
                onChange={(event) => update(index, { title: event.target.value })}
              />
            </label>
            <label className="field-stack">
              <span>五年后的理想画面</span>
              <textarea
                aria-label={`方案 ${index + 1} 理想画面`}
                value={plan.summary}
                disabled={disabled}
                onChange={(event) => update(index, { summary: event.target.value })}
                rows={4}
              />
            </label>
            <div className="two-column">
              <label className="field-stack">
                <span>工作里程碑</span>
                <input
                  aria-label={`方案 ${index + 1} 工作里程碑`}
                  value={plan.workMilestone}
                  disabled={disabled}
                  onChange={(event) => update(index, { workMilestone: event.target.value })}
                />
              </label>
              <label className="field-stack">
                <span>个人里程碑</span>
                <input
                  aria-label={`方案 ${index + 1} 个人里程碑`}
                  value={plan.personalMilestone}
                  disabled={disabled}
                  onChange={(event) => update(index, { personalMilestone: event.target.value })}
                />
              </label>
            </div>
            <div className="rating-grid">
              {ratings.map((rating) => (
                <label key={rating.key}>
                  <span>{rating.label}：{plan[rating.key]}</span>
                  <input
                    aria-label={`方案 ${index + 1} ${rating.label}`}
                    type="range"
                    min="0"
                    max="10"
                    value={plan[rating.key]}
                    disabled={disabled}
                    onChange={(event) => update(index, { [rating.key]: Number(event.target.value) })}
                  />
                </label>
              ))}
            </div>
          </fieldset>
        ))}
      </div>
      <button disabled={disabled || !complete}>保存并继续</button>
    </form>
  )
}
