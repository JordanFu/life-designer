'use client'

import type { BlueprintState } from '@life-design/core'

type BlueprintViewProps = {
  blueprint: BlueprintState
  onGenerate(): void | Promise<boolean>
  onDownload(): void
  onPrint(): void
  onExportMaterials(): void
}

function MarkdownDocument({ markdown }: { markdown: string }) {
  return (
    <article className="blueprint-document">
      {markdown.split('\n').map((raw, index) => {
        const line = raw.trim()
        if (!line) return <div className="blueprint-space" key={index} />
        if (line.startsWith('### ')) return <h3 key={index}>{line.slice(4)}</h3>
        if (line.startsWith('## ')) return <h2 key={index}>{line.slice(3)}</h2>
        if (line.startsWith('# ')) return <h1 key={index}>{line.slice(2)}</h1>
        if (/^[-*] /.test(line)) return <p className="blueprint-list-item" key={index}>{line.slice(2)}</p>
        return <p key={index}>{line}</p>
      })}
    </article>
  )
}

export function BlueprintView({
  blueprint,
  onGenerate,
  onDownload,
  onPrint,
  onExportMaterials,
}: BlueprintViewProps) {
  const hasBlueprint = Boolean(blueprint.markdown)

  if (blueprint.status === 'idle') {
    return (
      <section className="completion-card blueprint-start">
        <p className="completion-kicker">四阶段素材已齐全</p>
        <h2>现在，把这些线索连成属于你的蓝图。</h2>
        <p>
          四阶段素材已经齐全。Codex 会忠实使用你的原话，整理现状、真问题、指南针、能量模式、三个五年版本和下一步原型。
        </p>
        <button onClick={() => onGenerate()}>生成我的人生设计蓝图</button>
        <small>通常需要几十秒。生成前，你的全部素材已经保存在这台设备上。</small>
      </section>
    )
  }

  if (blueprint.status === 'generating') {
    return (
      <section className="completion-card blueprint-start" aria-live="polite">
        <p className="completion-kicker">素材已经安全保存</p>
        <h2>Codex 正在把四条线索织成一张地图</h2>
        <p>它正在核对你的原话、三个平等的五年版本与可以马上验证的原型。</p>
        <div className="thinking-line" aria-hidden="true"><span /></div>
      </section>
    )
  }

  if (blueprint.status === 'failed' && !hasBlueprint) {
    return (
      <section className="completion-card blueprint-start" aria-live="polite">
        <p className="completion-kicker">所有素材仍然安全</p>
        <h2>蓝图这次没有生成完成</h2>
        <p>{blueprint.error ?? '本地 Codex 暂时不可用。'}</p>
        <button onClick={() => onGenerate()}>重试生成</button>
        <button className="secondary-action" onClick={onExportMaterials}>先导出结构化素材</button>
      </section>
    )
  }

  return (
    <section className="blueprint-shell">
      {blueprint.status === 'failed' && (
        <aside className="blueprint-warning">
          <strong>旧蓝图仍然保留</strong>
          <span>{blueprint.error}</span>
          <button onClick={() => onGenerate()}>重新生成</button>
        </aside>
      )}
      <MarkdownDocument markdown={blueprint.markdown ?? ''} />
      <div className="blueprint-actions">
        <button onClick={onDownload}>下载 Markdown</button>
        <button className="secondary-action" onClick={onPrint}>打印或保存 PDF</button>
        <button className="secondary-action" onClick={onExportMaterials}>导出结构化素材</button>
        {blueprint.status === 'complete' && (
          <button className="text-action" onClick={() => onGenerate()}>重新生成</button>
        )}
      </div>
    </section>
  )
}
