'use client'

import { useEffect, useMemo } from 'react'
import { CheckpointRepository } from '@life-design/checkpoint'
import {
  stageLabels,
  steps,
  type LifeDesignResponse,
  type LifeDesignStage,
} from '@life-design/core'
import { StepForm } from './step-form'
import { CoachMoment } from './coach-moment'
import { BlueprintView } from './blueprint-view'
import { GuidedHereFlow } from './guided-here-flow'
import { useLifeDesignSession } from './use-life-design-session'

const stageOrder: Array<Exclude<LifeDesignStage, 'complete'>> = [
  'here',
  'compass',
  'wayfinding',
  'odyssey',
]

export function LifeDesignSession() {
  const repository = useMemo(() => new CheckpointRepository(), [])
  const {
    checkpoint,
    step,
    status,
    error,
    coachStatus,
    coachError,
    activeCoachTurn,
    submitResponse,
    saveHereDraft,
    goBackHere,
    completeHere,
    generateCoachMoment,
    continueAfterCoach,
    skipCoachMoment,
    generateBlueprint,
    downloadBlueprint,
    printBlueprint,
    exportCheckpoint,
  } = useLifeDesignSession(repository)

  useEffect(() => () => repository.close(), [repository])

  if (status === 'loading' || !checkpoint) {
    return <main className="shell loading">正在找回你上次停下的位置…</main>
  }

  const currentIndex = step ? steps.findIndex((item) => item.id === step.id) : steps.length
  const currentStageIndex =
    checkpoint.stage === 'complete' ? stageOrder.length : stageOrder.indexOf(checkpoint.stage)

  async function save(response: LifeDesignResponse) {
    await submitResponse(response)
  }

  return (
    <main className="shell">
      <header className="topbar">
        <div>
          <p className="eyebrow">LIFE DESIGN STUDIO</p>
          <h1>设计你的下一步</h1>
        </div>
        <span className="saved">{status === 'saving' ? '正在保存' : '已自动保存'}</span>
      </header>

      <ol className="progress" aria-label="人生设计阶段">
        {stageOrder.map((stage, index) => (
          <li
            className={
              index === currentStageIndex ? 'active' : index < currentStageIndex ? 'completed' : ''
            }
            key={stage}
          >
            {stageLabels[stage]}
          </li>
        ))}
      </ol>

      {checkpoint.legacyNotes.length > 0 && (
        <aside className="legacy-notice">
          <strong>旧测试回答已经保留</strong>
          <p>三题技术验证版没有收集完整结构，因此不会直接算作正式进度。你可以重新完成八步，旧回答仍保存在导出的素材中。</p>
        </aside>
      )}

      {checkpoint.coachPendingAfter ? (
        <>
          <CoachMoment
            anchor={checkpoint.coachPendingAfter}
            turn={activeCoachTurn}
            status={coachStatus}
            error={coachError}
            onGenerate={generateCoachMoment}
            onContinue={continueAfterCoach}
            onSkip={skipCoachMoment}
          />
          <p className="pause-note">
            可以随时关闭页面。你的原始回答已保存，下次仍会回到这次教练回应。
          </p>
        </>
      ) : checkpoint.hereGuidance ? (
        <>
          <GuidedHereFlow
            guidance={checkpoint.hereGuidance}
            disabled={status === 'saving'}
            onSave={saveHereDraft}
            onBack={goBackHere}
            onComplete={completeHere}
          />
          <p className="pause-note">
            可以随时关闭页面。每个小选择都会先保存在这台设备上，下次从这里继续。
          </p>
        </>
      ) : step ? (
        <>
          <section className="step-card" aria-live="polite">
            <div className="step-meta">
              <span>第 {currentIndex + 1} 步，共 {steps.length} 步</span>
              <span>{stageLabels[step.stage]}</span>
            </div>
            <h2>{step.title}</h2>
            <p className="step-prompt">{step.prompt}</p>
            <p className="step-hint">{step.hint}</p>
          </section>

          <StepForm step={step} disabled={status === 'saving'} onSubmit={save} />

          <p className="pause-note">
            可以随时关闭页面。每一步都会先保存在这台设备上，下次会从准确位置继续。
          </p>
        </>
      ) : (
        <BlueprintView
          blueprint={checkpoint.blueprint}
          onGenerate={generateBlueprint}
          onDownload={downloadBlueprint}
          onPrint={printBlueprint}
          onExportMaterials={exportCheckpoint}
        />
      )}

      {error && <p className="error">{error}。上一次完整保存的内容仍然保留。</p>}
    </main>
  )
}
