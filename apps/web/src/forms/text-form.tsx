'use client'

import type { FormEvent } from 'react'
import { useState } from 'react'
import type { LifeDesignStep, TextResponse } from '@life-design/core'

export function TextForm({
  step,
  disabled,
  onSubmit,
}: {
  step: LifeDesignStep
  disabled: boolean
  onSubmit(response: TextResponse): Promise<void>
}) {
  const [text, setText] = useState('')

  async function submit(event: FormEvent) {
    event.preventDefault()
    const trimmed = text.trim()
    if (trimmed.length < 2) return
    await onSubmit({ stepId: step.id as TextResponse['stepId'], kind: 'text', text: trimmed })
  }

  return (
    <form className="step-form" onSubmit={submit}>
      <label className="field-stack">
        <span>你的回答</span>
        <textarea
          aria-label="你的回答"
          value={text}
          disabled={disabled}
          onChange={(event) => setText(event.target.value)}
          placeholder="写一个具体、真实的版本，不用追求完整。"
          rows={7}
        />
      </label>
      <button disabled={disabled || text.trim().length < 2}>保存并继续</button>
    </form>
  )
}
