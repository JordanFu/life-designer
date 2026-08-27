'use client'

import type { FormEvent } from 'react'
import { useState } from 'react'
import type { EnergyMapResponse } from '@life-design/core'

type EnergyEvent = EnergyMapResponse['events'][number]

const emptyEvent = (): EnergyEvent => ({ activity: '', energy: 'neutral', engagement: 3 })

export function EnergyMapForm({
  disabled,
  onSubmit,
}: {
  disabled: boolean
  onSubmit(response: EnergyMapResponse): Promise<void>
}) {
  const [events, setEvents] = useState<EnergyMapResponse['events']>([
    emptyEvent(),
    emptyEvent(),
    emptyEvent(),
  ])
  const complete = events.every((item) => item.activity.trim().length >= 2)

  function update(index: number, patch: Partial<EnergyEvent>) {
    setEvents((current) =>
      current.map((item, itemIndex) => (itemIndex === index ? { ...item, ...patch } : item)) as
        EnergyMapResponse['events'],
    )
  }

  async function submit(event: FormEvent) {
    event.preventDefault()
    if (!complete) return
    await onSubmit({
      stepId: 'wayfinding.energy-map',
      kind: 'energy-map',
      events: events.map((item) => ({ ...item, activity: item.activity.trim() })) as EnergyMapResponse['events'],
    })
  }

  return (
    <form className="step-form" onSubmit={submit}>
      <div className="event-grid">
        {events.map((item, index) => (
          <fieldset className="event-card" key={index}>
            <legend>时刻 {index + 1}</legend>
            <label className="field-stack">
              <span>活动 {index + 1}</span>
              <input
                aria-label={`活动 ${index + 1}`}
                value={item.activity}
                disabled={disabled}
                onChange={(event) => update(index, { activity: event.target.value })}
                placeholder="例如：和用户做一小时访谈"
              />
            </label>
            <label className="field-stack">
              <span>做完后的能量</span>
              <select
                aria-label={`活动 ${index + 1} 的能量`}
                value={item.energy}
                disabled={disabled}
                onChange={(event) =>
                  update(index, { energy: event.target.value as EnergyEvent['energy'] })
                }
              >
                <option value="drain">被消耗</option>
                <option value="neutral">没有明显变化</option>
                <option value="gain">更有能量</option>
              </select>
            </label>
            <label className="field-stack">
              <span>投入程度：{item.engagement}/5</span>
              <input
                aria-label={`活动 ${index + 1} 的投入程度`}
                type="range"
                min="1"
                max="5"
                value={item.engagement}
                disabled={disabled}
                onChange={(event) => update(index, { engagement: Number(event.target.value) })}
              />
            </label>
          </fieldset>
        ))}
      </div>
      <button disabled={disabled || !complete}>保存并继续</button>
    </form>
  )
}
