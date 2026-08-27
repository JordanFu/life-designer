'use client'

import type { LifeDesignResponse, LifeDesignStep } from '@life-design/core'
import { DashboardForm } from './forms/dashboard-form'
import { EnergyMapForm } from './forms/energy-map-form'
import { OdysseyPlansForm } from './forms/odyssey-plans-form'
import { PrototypeForm } from './forms/prototype-form'
import { TextForm } from './forms/text-form'

export function StepForm({
  step,
  disabled,
  onSubmit,
}: {
  step: LifeDesignStep
  disabled: boolean
  onSubmit(response: LifeDesignResponse): Promise<void>
}) {
  if (step.kind === 'dashboard') {
    return <DashboardForm disabled={disabled} onSubmit={onSubmit} />
  }
  if (step.kind === 'text') {
    return <TextForm step={step} disabled={disabled} onSubmit={onSubmit} />
  }
  if (step.kind === 'energy-map') {
    return <EnergyMapForm disabled={disabled} onSubmit={onSubmit} />
  }
  if (step.kind === 'odyssey-plans') {
    return <OdysseyPlansForm disabled={disabled} onSubmit={onSubmit} />
  }
  return <PrototypeForm disabled={disabled} onSubmit={onSubmit} />
}
