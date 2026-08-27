'use client'

import { useState, type ReactNode } from 'react'
import {
  boundaryOptions,
  buildHereReflection,
  dashboardAnchor,
  feelingOptions,
  focusLabels,
  hereMicroStepOrder,
  problemOptionFor,
  problemOptionsFor,
  recommendFocus,
  type DashboardResponse,
  type FocusKey,
  type HereGuidance,
  type HereMicroStepId,
} from '@life-design/core'

type GuidedHereProps = {
  guidance: HereGuidance
  disabled: boolean
  onSave(guidance: HereGuidance): Promise<boolean>
  onBack(): Promise<boolean>
  onComplete(reflection: string): Promise<boolean>
}

type ScreenProps = GuidedHereProps & {
  advance(next: HereMicroStepId, patch?: Partial<HereGuidance>): Promise<boolean>
}

const dimensionNotes: Record<FocusKey, string> = {
  health: '身体、情绪与恢复状态',
  work: '职业、学习与贡献感',
  play: '纯粹为了快乐与好奇做的事',
  love: '家人、伴侣、朋友与真实连接',
}

const momentOptions: Array<{
  id: NonNullable<HereGuidance['momentWindow']>
  label: string
  note: string
}> = [
  { id: 'today', label: '今天', note: '刚刚发生，感觉还很清楚' },
  { id: 'this-week', label: '这周', note: '最近几天有一个明显时刻' },
  { id: 'this-month', label: '这个月', note: '这段时间反复出现' },
  { id: 'longer', label: '更早以前', note: '有一件一直记得的事' },
]

function GuideFrame({
  guidance,
  eyebrow,
  title,
  message,
  children,
}: {
  guidance: HereGuidance
  eyebrow: string
  title: string
  message: ReactNode
  children: ReactNode
}) {
  const index = hereMicroStepOrder.indexOf(guidance.currentMicroStepId)
  return (
    <section className="guided-flow" aria-live="polite">
      <div className="guided-progress-block">
        <div>
          <span>第一阶段：看清现在</span>
          <span>{index + 1}/9</span>
        </div>
        <div
          className="guided-progress-track"
          role="progressbar"
          aria-label="第一阶段进度"
          aria-valuemin={1}
          aria-valuemax={9}
          aria-valuenow={index + 1}
        >
          <span style={{ width: `${((index + 1) / 9) * 100}%` }} />
        </div>
      </div>

      <article className="coach-card">
        <p className="coach-eyebrow">{eyebrow}</p>
        <h2>{title}</h2>
        <div className="coach-message">{message}</div>
      </article>

      <div className="response-card">{children}</div>
    </section>
  )
}

function BackButton({ disabled, onBack }: Pick<GuidedHereProps, 'disabled' | 'onBack'>) {
  return (
    <button className="back-button" type="button" disabled={disabled} onClick={onBack}>
      返回上一步
    </button>
  )
}

function WelcomeScreen(props: ScreenProps) {
  return (
    <GuideFrame
      guidance={props.guidance}
      eyebrow="开始之前"
      title="先不用想清楚答案"
      message={
        <>
          <p>我们先花 5–8 分钟看清你此刻站在哪里。没有标准答案，也不用一次把人生想明白。</p>
          <p>我会先给选项和例子，再陪你回到一个真实时刻。你随时可以停下，下次从这里继续。</p>
        </>
      }
    >
      <div className="welcome-promise">
        <span>内容只保存在这台设备</span>
        <span>每次只问一个小问题</span>
        <span>结论由你修改和确认</span>
      </div>
      <details className="guide-details">
        <summary>先了解会问什么</summary>
        <p>会看四个生活维度、一个最近的真实时刻，以及哪些部分值得先行动。不会做心理诊断。</p>
      </details>
      <button
        type="button"
        disabled={props.disabled}
        onClick={() => props.advance('here.dashboard')}
      >
        开始看看
      </button>
    </GuideFrame>
  )
}

function DashboardScreen(props: ScreenProps) {
  const [scores, setScores] = useState<DashboardResponse['scores']>(
    props.guidance.scores ?? { health: 5, work: 5, play: 5, love: 5 },
  )

  return (
    <GuideFrame
      guidance={props.guidance}
      eyebrow="先看全貌"
      title="四个方面，先凭直觉看一眼"
      message={<p>分数不是评价。它只帮我们找到这次最值得先聊的地方，不需要为每一分写解释。</p>}
    >
      <div className="guided-score-grid">
        {(Object.keys(focusLabels) as FocusKey[]).map((key) => (
          <label className="guided-score-card" key={key}>
            <span className="score-heading">
              <span>
                <strong>{focusLabels[key]}</strong>
                <small>{dimensionNotes[key]}</small>
              </span>
              <output>{scores[key]}</output>
            </span>
            <input
              aria-label={key === 'love' ? '爱' : focusLabels[key]}
              type="range"
              min="0"
              max="10"
              value={scores[key]}
              disabled={props.disabled}
              onChange={(event) =>
                setScores((current) => ({ ...current, [key]: Number(event.target.value) }))
              }
            />
            <span className="score-anchor">{dashboardAnchor(scores[key])}</span>
          </label>
        ))}
      </div>
      <div className="guided-actions">
        <BackButton disabled={props.disabled} onBack={props.onBack} />
        <button
          type="button"
          disabled={props.disabled}
          onClick={() => props.advance('here.focus', { scores })}
        >
          看看哪里值得先聊
        </button>
      </div>
    </GuideFrame>
  )
}

function FocusScreen(props: ScreenProps) {
  const scores = props.guidance.scores
  if (!scores) throw new Error('Dashboard scores are required before choosing a focus')
  const recommended = recommendFocus(scores)

  return (
    <GuideFrame
      guidance={props.guidance}
      eyebrow="不用四处用力"
      title="这次先谈哪一个？"
      message={
        <p>
          从分数看，{focusLabels[recommended[0]]}和{focusLabels[recommended[1]]}
          更值得关注。但分数只是线索，真正要谈什么由你决定。
        </p>
      }
    >
      <div className="guided-choice-grid">
        {(Object.keys(focusLabels) as FocusKey[]).map((key) => {
          const suggested = recommended.includes(key)
          return (
            <button
              className="guided-choice"
              type="button"
              key={key}
              aria-label={`${focusLabels[key]}${suggested ? '，建议先看' : ''}`}
              disabled={props.disabled}
              onClick={() => props.advance('here.problem-shape', { focus: key })}
            >
              <span>
                <strong>{focusLabels[key]}</strong>
                <small>{dimensionNotes[key]}</small>
              </span>
              <span className="choice-score">{scores[key]}</span>
              {suggested && <em>建议先看</em>}
            </button>
          )
        })}
      </div>
      <BackButton disabled={props.disabled} onBack={props.onBack} />
    </GuideFrame>
  )
}

function ProblemShapeScreen(props: ScreenProps) {
  const focus = props.guidance.focus
  if (!focus) throw new Error('A focus is required before choosing a problem shape')
  const [selected, setSelected] = useState(props.guidance.problemShapeId ?? '')
  const [statement, setStatement] = useState(props.guidance.problemStatement ?? '')

  function choose(id: string, label: string) {
    setSelected(id)
    if (!statement || statement.startsWith('最近我最困扰的是：')) {
      setStatement(id.endsWith('.other') ? '最近我最困扰的是：' : `最近我最困扰的是：${label}。`)
    }
  }

  return (
    <GuideFrame
      guidance={props.guidance}
      eyebrow={`先给${focusLabels[focus]}里的困扰一个形状`}
      title="哪句话更像你的困扰？"
      message={<p>不用马上说得完整。先选一个接近的版本，再把它改成你自己的话。</p>}
    >
      <div className="guided-choice-grid problem-choices">
        {problemOptionsFor(focus).map((option) => (
          <button
            className={`guided-choice text-choice ${selected === option.id ? 'selected' : ''}`}
            type="button"
            key={option.id}
            aria-pressed={selected === option.id}
            disabled={props.disabled}
            onClick={() => choose(option.id, option.label)}
          >
            <strong>{option.label}</strong>
            <small>{option.note}</small>
          </button>
        ))}
      </div>
      {selected && (
        <label className="guided-field">
          <span>把困扰说成一句自己的话</span>
          <textarea
            aria-label="把困扰说成一句自己的话"
            value={statement}
            disabled={props.disabled}
            onChange={(event) => setStatement(event.target.value)}
            rows={3}
          />
        </label>
      )}
      <div className="guided-actions">
        <BackButton disabled={props.disabled} onBack={props.onBack} />
        <button
          type="button"
          disabled={props.disabled || !selected || statement.trim().length < 4}
          onClick={() =>
            props.advance('here.moment-when', {
              problemShapeId: selected,
              problemStatement: statement.trim(),
            })
          }
        >
          继续，找一个真实时刻
        </button>
      </div>
    </GuideFrame>
  )
}

function MomentWhenScreen(props: ScreenProps) {
  return (
    <GuideFrame
      guidance={props.guidance}
      eyebrow="从概念回到生活"
      title="最近什么时候最明显？"
      message={<p>不需要挑最严重的一次。选一个你还能回忆起细节的时刻就够了。</p>}
    >
      <div className="guided-choice-grid">
        {momentOptions.map((option) => (
          <button
            className="guided-choice text-choice"
            type="button"
            key={option.id}
            disabled={props.disabled}
            onClick={() =>
              props.advance('here.moment-event', { momentWindow: option.id })
            }
          >
            <strong>{option.label}</strong>
            <small>{option.note}</small>
          </button>
        ))}
      </div>
      <BackButton disabled={props.disabled} onBack={props.onBack} />
    </GuideFrame>
  )
}

function MomentEventScreen(props: ScreenProps) {
  const [details, setDetails] = useState(props.guidance.momentDetails ?? '')
  const option =
    props.guidance.focus && props.guidance.problemShapeId
      ? problemOptionFor(props.guidance.focus, props.guidance.problemShapeId)
      : undefined

  return (
    <GuideFrame
      guidance={props.guidance}
      eyebrow="只说当时那一幕"
      title="当时具体发生了什么？"
      message={
        <p>
          先别分析原因。只写谁在场、发生了什么，以及你注意到的那个瞬间。
          {option ? `例如，可以从“${option.note}的那一次”开始。` : ''}
        </p>
      }
    >
      <label className="guided-field">
        <span>那个时刻</span>
        <textarea
          aria-label="那个时刻发生了什么"
          value={details}
          disabled={props.disabled}
          onChange={(event) => setDetails(event.target.value)}
          placeholder="例如：周一项目会上，大家开始讨论下一季度计划时，我发现自己完全不想参与。"
          rows={5}
        />
      </label>
      <div className="guided-actions">
        <BackButton disabled={props.disabled} onBack={props.onBack} />
        <button
          type="button"
          disabled={props.disabled || details.trim().length < 6}
          onClick={() =>
            props.advance('here.feelings', { momentDetails: details.trim() })
          }
        >
          继续，看看当时的感受
        </button>
      </div>
    </GuideFrame>
  )
}

function FeelingsScreen(props: ScreenProps) {
  const [feelings, setFeelings] = useState<HereGuidance['feelings']>(props.guidance.feelings)
  const [note, setNote] = useState(props.guidance.feelingNote)

  function toggle(id: HereGuidance['feelings'][number]) {
    setFeelings((current) => {
      if (current.includes(id)) return current.filter((item) => item !== id)
      if (current.length >= 2) return current
      return [...current, id]
    })
  }

  return (
    <GuideFrame
      guidance={props.guidance}
      eyebrow="感受也是信息"
      title="那一刻，什么感觉最接近？"
      message={<p>最多选两个。我们不是给你贴标签，只是看看这件事为什么如此重要。</p>}
    >
      <div className="feeling-grid">
        {feelingOptions.map((option) => (
          <button
            className={feelings.includes(option.id) ? 'selected' : ''}
            type="button"
            key={option.id}
            aria-pressed={feelings.includes(option.id)}
            disabled={props.disabled}
            onClick={() => toggle(option.id)}
          >
            {option.label}
          </button>
        ))}
      </div>
      <label className="guided-field compact">
        <span>还有别的感受？可以不填</span>
        <input
          aria-label="补充感受"
          value={note}
          disabled={props.disabled}
          onChange={(event) => setNote(event.target.value)}
          placeholder="例如：也有一点不甘心"
        />
      </label>
      <div className="guided-actions">
        <BackButton disabled={props.disabled} onBack={props.onBack} />
        <button
          type="button"
          disabled={props.disabled || feelings.length === 0}
          onClick={() =>
            props.advance('here.boundaries', { feelings, feelingNote: note.trim() })
          }
        >
          继续，分清哪些值得设计
        </button>
      </div>
    </GuideFrame>
  )
}

function BoundariesScreen(props: ScreenProps) {
  const [boundaryType, setBoundaryType] = useState(props.guidance.boundaryType)
  const [nextAction, setNextAction] = useState(props.guidance.nextAction ?? '')

  return (
    <GuideFrame
      guidance={props.guidance}
      eyebrow="不是所有问题都该硬解"
      title="这件事里，你能推动哪一部分？"
      message={<p>承认现实边界不等于认输。人生设计只处理能尝试、能影响的问题。</p>}
    >
      <div className="guided-choice-grid boundary-grid">
        {boundaryOptions.map((option) => (
          <button
            className={`guided-choice text-choice ${boundaryType === option.id ? 'selected' : ''}`}
            type="button"
            key={option.id}
            aria-pressed={boundaryType === option.id}
            disabled={props.disabled}
            onClick={() => setBoundaryType(option.id)}
          >
            <strong>{option.label}</strong>
            <small>{option.note}</small>
          </button>
        ))}
      </div>
      {boundaryType && (
        <label className="guided-field">
          <span>不解决整个人生，我可以先……</span>
          <textarea
            aria-label="我可以先做什么"
            value={nextAction}
            disabled={props.disabled}
            onChange={(event) => setNextAction(event.target.value)}
            placeholder="例如：约一位不同岗位的朋友，聊聊他的真实工作日常。"
            rows={3}
          />
        </label>
      )}
      <div className="guided-actions">
        <BackButton disabled={props.disabled} onBack={props.onBack} />
        <button
          type="button"
          disabled={props.disabled || !boundaryType || nextAction.trim().length < 4}
          onClick={() => {
            const nextDraft = {
              ...props.guidance,
              boundaryType,
              nextAction: nextAction.trim(),
              currentMicroStepId: 'here.summary' as const,
            }
            return props.onSave({
              ...nextDraft,
              reflection: buildHereReflection(nextDraft),
            })
          }}
        >
          看看我听到了什么
        </button>
      </div>
    </GuideFrame>
  )
}

function SummaryScreen(props: ScreenProps) {
  const [reflection, setReflection] = useState(
    props.guidance.reflection ?? buildHereReflection(props.guidance),
  )

  return (
    <GuideFrame
      guidance={props.guidance}
      eyebrow="先确认，再继续"
      title="我听到的是"
      message={<p>下面只是根据你的回答整理出的复述草稿，不是诊断，也不是替你下结论。请把不准确的地方直接改掉。</p>}
    >
      <label className="guided-field reflection-field">
        <span>这段话的决定权在你</span>
        <textarea
          aria-label="第一阶段小结"
          value={reflection}
          disabled={props.disabled}
          onChange={(event) => setReflection(event.target.value)}
          rows={10}
        />
      </label>
      <p className="reflection-note">确认后，它会成为后面探索工作观、人生观和多种可能的上下文。</p>
      <div className="guided-actions">
        <BackButton disabled={props.disabled} onBack={props.onBack} />
        <button
          type="button"
          disabled={props.disabled || reflection.trim().length < 10}
          onClick={() => props.onComplete(reflection.trim())}
        >
          这基本准确，进入下一阶段
        </button>
      </div>
    </GuideFrame>
  )
}

export function GuidedHereFlow(props: GuidedHereProps) {
  const advance: ScreenProps['advance'] = (next, patch = {}) =>
    props.onSave({ ...props.guidance, ...patch, currentMicroStepId: next })
  const screenProps = { ...props, advance }

  switch (props.guidance.currentMicroStepId) {
    case 'here.welcome':
      return <WelcomeScreen {...screenProps} />
    case 'here.dashboard':
      return <DashboardScreen {...screenProps} />
    case 'here.focus':
      return <FocusScreen {...screenProps} />
    case 'here.problem-shape':
      return <ProblemShapeScreen {...screenProps} />
    case 'here.moment-when':
      return <MomentWhenScreen {...screenProps} />
    case 'here.moment-event':
      return <MomentEventScreen {...screenProps} />
    case 'here.feelings':
      return <FeelingsScreen {...screenProps} />
    case 'here.boundaries':
      return <BoundariesScreen {...screenProps} />
    case 'here.summary':
      return <SummaryScreen {...screenProps} />
  }
}
