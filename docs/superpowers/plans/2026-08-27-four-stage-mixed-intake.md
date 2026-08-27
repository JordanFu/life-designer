# Four-Stage Mixed Intake Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the three-open-question technical slice with an eight-step, four-stage mixed-input experience that cannot claim completion until all required life-design material is saved.

**Architecture:** Upgrade the checkpoint to schema version 2 with a discriminated response union and an explicit v1 migration. The core package remains the source of truth for steps, stage transitions and blueprint readiness; React renders one focused form per response kind and persists every submitted step before advancing.

**Tech Stack:** TypeScript, Zod, Dexie/IndexedDB, React 19, Next.js 16, Vitest, Testing Library, Playwright.

---

## File map

```text
packages/life-design-core/src/checkpoint.ts             v1/v2 schemas and response types
packages/life-design-core/src/steps.ts                  eight canonical steps and stage metadata
packages/life-design-core/src/session.ts                create, migrate, record, advance, readiness
packages/life-design-core/src/session.test.ts           domain and migration tests
packages/checkpoint/src/repository.ts                   migrate v1 records on load
packages/checkpoint/src/repository.test.ts              persisted migration test
apps/web/src/use-life-design-session.ts                 submit typed response and recover pending advance
apps/web/src/use-life-design-session.test.tsx           controller restore tests
apps/web/src/step-form.tsx                              renderer switch
apps/web/src/forms/dashboard-form.tsx                   four 0–10 sliders
apps/web/src/forms/text-form.tsx                        guided short answer
apps/web/src/forms/energy-map-form.tsx                  three energy events
apps/web/src/forms/odyssey-plans-form.tsx               three equal-status five-year plans
apps/web/src/forms/prototype-form.tsx                   one low-cost experiment
apps/web/src/life-design-session.tsx                    stage shell and completion gate
apps/web/app/globals.css                                responsive form/card styles
apps/web/e2e/full-journey.spec.ts                       eight-step golden path and resume
README.md                                               current product status
```

### Task 1: Upgrade the domain model to eight typed steps

**Files:**
- Modify: `packages/life-design-core/src/checkpoint.ts`
- Create: `packages/life-design-core/src/steps.ts`
- Modify: `packages/life-design-core/src/session.ts`
- Modify: `packages/life-design-core/src/session.test.ts`

- [ ] **Step 1: Write failing tests for canonical order, typed responses and readiness**

Add tests that assert:

```ts
expect(steps.map((step) => step.id)).toEqual([
  'here.dashboard', 'here.primary-problem', 'here.why-now',
  'compass.workview', 'compass.lifeview', 'wayfinding.energy-map',
  'odyssey.plans', 'odyssey.prototype',
])

const saved = recordResponse(initial, {
  stepId: 'here.dashboard', kind: 'dashboard',
  scores: { health: 6, work: 3, play: 4, love: 8 },
}, now)
expect(saved.pendingOperation).toEqual({ type: 'advance-step', stepId: 'here.dashboard' })
expect(isReadyForBlueprint(saved)).toBe(false)
```

Add a v1 migration test proving three legacy strings are retained in `legacyNotes` and the new session restarts at `here.dashboard` instead of silently treating incomplete data as complete.

- [ ] **Step 2: Run the core test and verify RED**

Run: `pnpm --filter @life-design/core test`

Expected: FAIL because `steps`, `recordResponse`, `migrateCheckpoint` and `isReadyForBlueprint` do not exist.

- [ ] **Step 3: Implement the v2 schemas**

Define these response shapes in `checkpoint.ts`:

```ts
type DashboardResponse = {
  stepId: 'here.dashboard'; kind: 'dashboard'
  scores: { health: number; work: number; play: number; love: number }
}
type TextResponse = {
  stepId: 'here.primary-problem' | 'here.why-now' | 'compass.workview' | 'compass.lifeview'
  kind: 'text'; text: string
}
type EnergyMapResponse = {
  stepId: 'wayfinding.energy-map'; kind: 'energy-map'
  events: Array<{ activity: string; energy: 'drain' | 'neutral' | 'gain'; engagement: number }>
}
type OdysseyPlansResponse = {
  stepId: 'odyssey.plans'; kind: 'odyssey-plans'
  plans: Array<{
    title: string; summary: string; workMilestone: string; personalMilestone: string
    resources: number; excitement: number; confidence: number; coherence: number
  }>
}
type PrototypeResponse = {
  stepId: 'odyssey.prototype'; kind: 'prototype'; planIndex: number
  experimentType: 'conversation' | 'experience' | 'artifact'; action: string; timing: string
}
```

Zod requirements: scores and ratings 0–10; text fields non-empty; energy events exactly 3; Odyssey plans exactly 3; prototype plan index 0–2.

- [ ] **Step 4: Implement canonical steps and state transitions**

`steps.ts` exports eight steps, four stage labels and each form kind. `session.ts` exports:

```ts
createCheckpoint(sessionId, now): LifeDesignCheckpoint
migrateCheckpoint(raw, now): LifeDesignCheckpoint
recordResponse(checkpoint, response, now): LifeDesignCheckpoint
advanceAfterSavedResponse(checkpoint, now): LifeDesignCheckpoint
isReadyForBlueprint(checkpoint): boolean
```

`recordResponse` rejects a response whose `stepId` differs from `currentStepId`. `advanceAfterSavedResponse` derives the next step and stage from the canonical array. Readiness is true only when all eight step IDs are completed, eight valid responses exist, no operation is pending and `currentStepId` is null.

- [ ] **Step 5: Run core tests and commit**

Run: `pnpm --filter @life-design/core test && pnpm --filter @life-design/core typecheck`

Expected: all core tests PASS and TypeScript exits 0.

```bash
git add packages/life-design-core
git commit -m "feat: model complete four-stage intake"
```

### Task 2: Migrate persisted sessions and typed controller submissions

**Files:**
- Modify: `packages/checkpoint/src/repository.ts`
- Modify: `packages/checkpoint/src/repository.test.ts`
- Modify: `apps/web/src/use-life-design-session.ts`
- Modify: `apps/web/src/use-life-design-session.test.tsx`

- [ ] **Step 1: Write failing persistence and controller tests**

Persist this v1 fixture directly, reopen it and assert the repository returns schema version 2 with legacy notes and `here.dashboard` as the current step. In the hook test, call `submitResponse()` with a dashboard response, remount, and assert restoration at `here.primary-problem`.

- [ ] **Step 2: Run tests and verify RED**

Run: `pnpm --filter @life-design/checkpoint test && pnpm --filter @life-design/web test -- use-life-design-session.test.tsx`

Expected: FAIL because persisted v1 values are parsed as v2 and the hook still exposes `answer(string)`.

- [ ] **Step 3: Implement migration on repository load**

Load the raw Dexie value as `unknown`, call `migrateCheckpoint(raw, new Date().toISOString())`, and save the migrated value when its revision/schema changed. Preserve stale-write protection for ordinary saves.

- [ ] **Step 4: Replace `answer` with typed `submitResponse`**

The hook must expose:

```ts
submitResponse(response: LifeDesignResponse): Promise<boolean>
exportCheckpoint(): void
```

The controller saves the response-bearing checkpoint first, then saves the advanced checkpoint. On load it completes any persisted `advance-step` operation before rendering.

- [ ] **Step 5: Run tests and commit**

Run: `pnpm test && pnpm typecheck`

Expected: repository, migration, core and hook tests all PASS.

```bash
git add packages/checkpoint apps/web/src/use-life-design-session.ts apps/web/src/use-life-design-session.test.tsx
git commit -m "feat: migrate and restore typed intake sessions"
```

### Task 3: Add five mixed-input form components

**Files:**
- Create: `apps/web/src/step-form.tsx`
- Create: `apps/web/src/forms/dashboard-form.tsx`
- Create: `apps/web/src/forms/text-form.tsx`
- Create: `apps/web/src/forms/energy-map-form.tsx`
- Create: `apps/web/src/forms/odyssey-plans-form.tsx`
- Create: `apps/web/src/forms/prototype-form.tsx`
- Create: `apps/web/src/step-form.test.tsx`

- [ ] **Step 1: Write failing form tests**

Test that dashboard submission emits four numeric scores; text submission trims content; energy-map submission remains disabled until three events are filled; Odyssey submission emits exactly three equally shaped plans; prototype submission emits one selected plan and experiment type.

- [ ] **Step 2: Run the form test and verify RED**

Run: `pnpm --filter @life-design/web test -- step-form.test.tsx`

Expected: FAIL because `StepForm` does not exist.

- [ ] **Step 3: Implement forms with one response callback**

Every form accepts:

```ts
{ step: LifeDesignStep; disabled: boolean; onSubmit(response: LifeDesignResponse): Promise<void> }
```

Dashboard uses four labelled ranges. Text form shows the step prompt and a stage-specific hint. Energy map renders three event rows with activity, energy select and 1–5 engagement. Odyssey renders three numbered plan cards; none is labelled backup. Prototype renders plan choice, conversation/experience/artifact cards, action and timing.

- [ ] **Step 4: Run tests and commit**

Run: `pnpm --filter @life-design/web test -- step-form.test.tsx && pnpm typecheck`

Expected: all form tests PASS and TypeScript exits 0.

```bash
git add apps/web/src/forms apps/web/src/step-form.tsx apps/web/src/step-form.test.tsx
git commit -m "feat: add mixed life design input forms"
```

### Task 4: Replace the technical page with the four-stage journey

**Files:**
- Modify: `apps/web/src/life-design-session.tsx`
- Modify: `apps/web/app/globals.css`
- Modify: `apps/web/src/use-life-design-session.test.tsx`

- [ ] **Step 1: Write a failing completion-gate component test**

Assert the initial page contains “第 1 步，共 8 步” and no blueprint/download action. Submit one valid response and assert the second step appears. Assert the completion card appears only when `isReadyForBlueprint` is true and calls the final export “导出人生设计素材”, not “人生设计蓝图”.

- [ ] **Step 2: Run the test and verify RED**

Run: `pnpm --filter @life-design/web test`

Expected: FAIL because the page still renders the three-question technical slice.

- [ ] **Step 3: Implement the journey shell**

Render stage progress, exact step position, autosave status, any migrated legacy-note notice, the current `StepForm`, and a “保存并暂时离开” explanation. Do not render a completion/download action before readiness. On completion explain that the material is ready for the later AI blueprint-generation stage.

- [ ] **Step 4: Add responsive mixed-form styles**

Add `.step-meta`, `.score-grid`, `.score-row`, `.event-grid`, `.plan-card`, `.rating-grid`, `.choice-grid`, `.completion-actions` and mobile rules. Keep inputs at least 44px high, preserve labels, and verify no horizontal scrolling at 412px.

- [ ] **Step 5: Run unit tests, type checking and build, then commit**

Run: `pnpm test && pnpm typecheck && pnpm --filter @life-design/web build`

Expected: all tests PASS, TypeScript exits 0 and Next build succeeds.

```bash
git add apps/web/src apps/web/app/globals.css
git commit -m "feat: guide users through all four stages"
```

### Task 5: Prove the full mixed journey and update the PR

**Files:**
- Replace: `apps/web/e2e/export.spec.ts`
- Replace: `apps/web/e2e/resume.spec.ts`
- Create: `apps/web/e2e/full-journey.spec.ts`
- Modify: `README.md`

- [ ] **Step 1: Write the failing full-journey E2E**

The test fills all eight steps using their labels, closes and reopens after the dashboard, verifies exact restoration, asserts no completion action at step seven, completes a prototype, downloads the material checkpoint, and checks `schemaVersion === 2`, eight responses, three energy events, three Odyssey plans and no credential-shaped field.

- [ ] **Step 2: Run E2E and verify RED**

Run: `pnpm test:e2e`

Expected: FAIL until selectors, persistence and completion gating match the full journey.

- [ ] **Step 3: Update README wording**

Document the eight-step mixed-input Stage 1, state explicitly that AI blueprint generation is the next slice, and retain the upstream Agent/CLI instructions and attribution.

- [ ] **Step 4: Run the final verification suite**

Run: `pnpm test && pnpm typecheck && pnpm test:e2e && pnpm --filter @life-design/web build`

Expected: all unit/controller/form tests and all mobile E2E tests PASS; TypeScript and production build exit 0.

- [ ] **Step 5: Commit and push**

```bash
git add apps/web/e2e README.md
git commit -m "test: verify complete mixed intake journey"
git push origin stage-0-resumable-slice
```

Update PR #1 title to `feat: add resumable four-stage Life Design Studio intake` and describe the new eight-step acceptance path.

## Definition of done

- The user sees eight main steps across all four life-design stages.
- At least five interaction patterns are used; the experience is not an open-question-only survey.
- Three energy events and three equal-status Odyssey plans are mandatory.
- Every response is saved before the cursor advances and survives page closure.
- A migrated Stage 0 checkpoint is retained as legacy notes and cannot falsely unlock completion.
- No blueprint or final-download language appears before all required responses exist.
- Completion exports “人生设计素材”; AI blueprint generation remains clearly identified as the next slice.
