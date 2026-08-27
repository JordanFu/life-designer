'use client'

import type { FormEvent } from 'react'
import { useMemo, useState } from 'react'
import { CheckpointRepository } from '@life-design/checkpoint'
import { useLifeDesignSession } from './use-life-design-session'

export function LifeDesignSession() {
  const repository = useMemo(() => new CheckpointRepository(), [])
  const { checkpoint, question, status, error, answer, exportCheckpoint } =
    useLifeDesignSession(repository)
  const [text, setText] = useState('')

  async function submit(event: FormEvent) {
    event.preventDefault()
    const value = text.trim()
    if (!value || status === 'saving') return
    const saved = await answer(value)
    if (saved) setText('')
  }

  if (status === 'loading') {
    return <main className="shell loading">正在找回你的进度…</main>
  }

  return (
    <main className="shell">
      <header className="topbar">
        <div>
          <p className="eyebrow">LIFE DESIGN STUDIO</p>
          <h1>先看清你在哪里</h1>
        </div>
        <span className="saved">{status === 'saving' ? '正在保存' : '已自动保存'}</span>
      </header>

      <ol className="progress" aria-label="人生设计阶段">
        <li className="active">你在这里</li>
        <li>指南针</li>
        <li>寻路</li>
        <li>多种可能</li>
      </ol>

      <section className="conversation" aria-live="polite">
        {checkpoint?.answers.map((item) => (
          <article className="answer" key={`${item.questionId}-${item.answeredAt}`}>
            {item.text}
          </article>
        ))}
        {question ? (
          <article className="question">
            <p>我们先只看这一件事。</p>
            <h2>{question.text}</h2>
          </article>
        ) : (
          <article className="question complete">
            <p>这一小段已经完成。</p>
            <h2>你的三次回答都已安全保存在这台设备上。</h2>
          </article>
        )}
      </section>

      {error && <p className="error">{error}。你的上一次完整回答仍然保留。</p>}

      {question ? (
        <form className="composer" onSubmit={submit}>
          <label htmlFor="answer">你的回答</label>
          <textarea
            id="answer"
            value={text}
            onChange={(event) => setText(event.target.value)}
            placeholder="不用组织得很完整，写下此刻最真实的答案。"
            rows={5}
          />
          <button disabled={!text.trim() || status === 'saving'}>保存并继续</button>
        </form>
      ) : (
        <button className="export" onClick={exportCheckpoint}>
          下载我的进度包
        </button>
      )}
    </main>
  )
}
