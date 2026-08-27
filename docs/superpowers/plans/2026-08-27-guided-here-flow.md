# Guided “You Are Here” Flow Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the first three abstract intake forms with a resumable, locally guided sequence that moves from ratings to focus, a concrete moment, feelings, boundaries, and an editable reflection.

**Architecture:** Keep the existing eight canonical Life Design responses and downstream forms. Add a v3 checkpoint-owned `hereGuidance` draft and pure guidance helpers; the UI saves every micro-step before advancing, then converts the confirmed draft into the existing three “here” responses in one atomic domain transition. The guidance engine is deterministic and local, with future AI follow-up and reflection adapters kept outside the persistence model.

**Tech Stack:** TypeScript, React 19, Next.js 16, Zod, Dexie/IndexedDB, Vitest, Testing Library, Playwright.

---

## File map

- Modify `packages/life-design-core/src/checkpoint.ts`: v3 schemas and guided-here draft types.
- Create `packages/life-design-core/src/guidance.ts`: micro-step order, option content, recommendations, reflection template.
- Modify `packages/life-design-core/src/session.ts`: v2 migration, guided draft save/back, atomic first-stage completion.
- Modify `packages/life-design-core/src/session.test.ts`: domain and migration coverage.
- Modify `packages/life-design-core/src/index.ts`: export the guidance API.
- Modify `apps/web/src/use-life-design-session.ts`: expose guidance save/back/complete actions.
- Modify `apps/web/src/use-life-design-session.test.tsx`: exact micro-step recovery and completion tests.
- Create `apps/web/src/guided-here-flow.tsx`: one-question-at-a-time guided first-stage UI.
- Modify `apps/web/src/life-design-session.tsx`: route the “here” stage into the guide.
- Modify `apps/web/src/life-design-session.test.tsx`: no blank textarea at entry and guided flow integration.
- Modify `apps/web/app/globals.css`: coach card, anchored scores, choice cards, reflection and mobile states.
- Modify `apps/web/e2e/full-journey.spec.ts`: guided first stage, refresh recovery, then existing remaining stages.
- Modify `README.md`: describe the guided first-stage vertical slice.

### Task 1: Model the v3 guided checkpoint

**Files:**
- Modify: `packages/life-design-core/src/checkpoint.ts`
- Create: `packages/life-design-core/src/guidance.ts`
- Modify: `packages/life-design-core/src/index.ts`
- Test: `packages/life-design-core/src/session.test.ts`

- [ ] **Step 1: Write failing schema and guidance tests**

Add tests that assert a new checkpoint starts at `here.welcome`, recommends the lowest dashboard dimensions, returns focus-specific problem options, and builds a transparent reflection from structured inputs:

```ts
expect(createCheckpoint('session-1', now).hereGuidance?.currentMicroStepId).toBe('here.welcome')
expect(recommendFocus({ health: 6, work: 2, play: 2, love: 8 })).toEqual(['work', 'play'])
expect(problemOptionsFor('work').map((item) => item.id)).toContain('work.direction')
expect(buildHereReflection(completeGuidanceDraft)).toContain('工作')
```

- [ ] **Step 2: Run the core test and verify red**

Run: `pnpm --filter @life-design/core test`

Expected: FAIL because the guidance exports and v3 fields do not exist.

- [ ] **Step 3: Add v3 schemas and deterministic guidance content**

Define:

```ts
export const hereMicroStepIdSchema = z.enum([
  'here.welcome',
  'here.dashboard',
  'here.focus',
  'here.problem-shape',
  'here.moment-when',
  'here.moment-event',
  'here.feelings',
  'here.boundaries',
  'here.summary',
])

export const hereGuidanceSchema = z.object({
  currentMicroStepId: hereMicroStepIdSchema,
  scores: dashboardResponseSchema.shape.scores.optional(),
  focus: z.enum(['health', 'work', 'play', 'love']).optional(),
  problemShapeId: z.string().min(1).max(80).optional(),
  problemStatement: z.string().trim().min(2).max(1000).optional(),
  momentWindow: z.enum(['today', 'this-week', 'this-month', 'longer']).optional(),
  momentDetails: z.string().trim().min(2).max(1500).optional(),
  feelings: z.array(z.enum(['anxious', 'tired', 'lost', 'angry', 'sad', 'numb', 'lonely', 'hopeful'])).max(2).default([]),
  feelingNote: z.string().trim().max(300).default(''),
  boundaryType: z.enum(['direct', 'influence', 'gravity', 'mixed']).optional(),
  nextAction: z.string().trim().min(2).max(500).optional(),
  reflection: z.string().trim().min(10).max(3000).optional(),
})
```

Make `checkpointSchema` version 3 and add `hereGuidance: hereGuidanceSchema.nullable()`. Preserve a separately named exported v2 schema for migration.

In `guidance.ts`, export the micro-step order, dashboard anchors, focus labels, focus-specific option sets, feeling options, boundary options, `recommendFocus(scores)`, `problemOptionsFor(focus)`, and `buildHereReflection(draft)`. Reflection text must use “我听到的是” and “可能” rather than diagnostic language.

- [ ] **Step 4: Run the core test and verify green**

Run: `pnpm --filter @life-design/core test`

Expected: all core tests pass.

- [ ] **Step 5: Commit**

```bash
git add packages/life-design-core/src
git commit -m "feat: model resumable guided first stage"
```

### Task 2: Add safe migration and atomic guidance transitions

**Files:**
- Modify: `packages/life-design-core/src/session.ts`
- Test: `packages/life-design-core/src/session.test.ts`
- Test: `packages/checkpoint/src/repository.test.ts`

- [ ] **Step 1: Write failing transition tests**

Cover:

```ts
const focused = saveHereGuidance(checkpoint, {
  ...checkpoint.hereGuidance!,
  currentMicroStepId: 'here.problem-shape',
  scores,
  focus: 'work',
}, later)
expect(focused.revision).toBe(checkpoint.revision + 1)

const previous = goBackHereGuidance(focused, laterStill)
expect(previous.hereGuidance?.currentMicroStepId).toBe('here.focus')

const completed = completeHereGuidance(readyForSummary, editedReflection, finalTime)
expect(completed.currentStepId).toBe('compass.workview')
expect(completed.completedStepIds).toEqual(expect.arrayContaining([
  'here.dashboard', 'here.primary-problem', 'here.why-now',
]))
expect(completed.responses.filter((item) => item.stepId.startsWith('here.'))).toHaveLength(3)
```

Add v2 migrations for fresh, partially completed, fully completed “here”, later-stage, and pending-operation checkpoints. Existing answers must be preserved; no migrated later-stage user is sent backwards.

- [ ] **Step 2: Run focused tests and verify red**

Run: `pnpm --filter @life-design/core test && pnpm --filter @life-design/checkpoint test`

Expected: FAIL because v3 transitions and migrations are missing.

- [ ] **Step 3: Implement validated transitions**

Add:

```ts
export function saveHereGuidance(
  checkpoint: LifeDesignCheckpoint,
  guidance: HereGuidance,
  now: string,
): LifeDesignCheckpoint

export function goBackHereGuidance(
  checkpoint: LifeDesignCheckpoint,
  now: string,
): LifeDesignCheckpoint

export function completeHereGuidance(
  checkpoint: LifeDesignCheckpoint,
  reflection: string,
  now: string,
): LifeDesignCheckpoint
```

`saveHereGuidance` validates the full draft and increments the revision. `goBackHereGuidance` uses the ordered micro-step list and preserves answers. `completeHereGuidance` requires every structured field, converts the draft to one dashboard response plus two text responses, marks all three canonical steps complete, sets `currentStepId` to `compass.workview`, clears `hereGuidance`, and increments only once.

Migration rules:

- no v2 “here” responses → `here.welcome`;
- dashboard response only → restore scores at `here.focus`;
- primary-problem response present → preserve it and resume at the first missing concrete-moment micro-step;
- all three “here” responses or any later stage → keep canonical position and set `hereGuidance` to `null`;
- normalize any v2 pending operation before choosing the v3 position.

- [ ] **Step 4: Run focused tests and verify green**

Run: `pnpm --filter @life-design/core test && pnpm --filter @life-design/checkpoint test`

Expected: all focused tests pass.

- [ ] **Step 5: Commit**

```bash
git add packages/life-design-core packages/checkpoint
git commit -m "feat: persist guided first-stage progress"
```

### Task 3: Expose save, back, and completion actions to React

**Files:**
- Modify: `apps/web/src/use-life-design-session.ts`
- Test: `apps/web/src/use-life-design-session.test.tsx`

- [ ] **Step 1: Write failing hook tests**

Assert that `saveHereDraft(nextDraft)` persists before updating UI state, remount restores the exact micro-step and fields, `goBackHere()` preserves draft values, and `completeHere(reflection)` advances to `compass.workview`.

```ts
await act(() => result.current.saveHereDraft(nextDraft))
expect((await repository.load(sessionId))?.hereGuidance).toEqual(nextDraft)

await act(() => result.current.goBackHere())
expect(result.current.checkpoint?.hereGuidance?.currentMicroStepId).toBe('here.focus')
```

- [ ] **Step 2: Run the web hook test and verify red**

Run: `pnpm --filter @life-design/web test -- use-life-design-session.test.tsx`

Expected: FAIL because the hook actions are not exported.

- [ ] **Step 3: Implement hook actions through one persistence helper**

Create an internal helper that sets `saving`, clears the error, saves the next checkpoint, then updates React state. Expose:

```ts
saveHereDraft(guidance: HereGuidance): Promise<boolean>
goBackHere(): Promise<boolean>
completeHere(reflection: string): Promise<boolean>
```

On save failure, keep the current checkpoint and return `false`. Existing canonical `submitResponse` behavior remains unchanged for the final five steps.

- [ ] **Step 4: Run the hook tests and verify green**

Run: `pnpm --filter @life-design/web test -- use-life-design-session.test.tsx`

Expected: hook tests pass.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/use-life-design-session.ts apps/web/src/use-life-design-session.test.tsx
git commit -m "feat: control guided progress from the web session"
```

### Task 4: Build the one-question-at-a-time coach UI

**Files:**
- Create: `apps/web/src/guided-here-flow.tsx`
- Modify: `apps/web/src/life-design-session.tsx`
- Modify: `apps/web/app/globals.css`
- Test: `apps/web/src/life-design-session.test.tsx`

- [ ] **Step 1: Write failing interaction tests**

Test the user-visible contract:

```ts
expect(screen.getByRole('heading', { name: '先不用想清楚答案' })).toBeVisible()
expect(screen.queryByRole('textbox')).not.toBeInTheDocument()

await user.click(screen.getByRole('button', { name: '开始看看' }))
expect(screen.getByText('勉强维持，需要关注')).toBeVisible()

// Submit scores, choose recommended “工作”, choose a problem card,
// complete time/event/feelings/boundary and edit the reflection.
expect(screen.getByText('我听到的是')).toBeVisible()
```

Also verify a back action returns to the prior micro-step with the prior selection intact.

- [ ] **Step 2: Run the UI tests and verify red**

Run: `pnpm --filter @life-design/web test -- life-design-session.test.tsx`

Expected: FAIL because the guided UI does not exist.

- [ ] **Step 3: Implement the guided flow**

`GuidedHereFlow` receives the checkpoint-owned draft and three async actions. Render exactly one micro-step at a time:

- welcome: expectation, duration, privacy and “开始看看”;
- dashboard: four anchored ratings and a single continue action;
- focus: show the two lowest dimensions first but allow all four;
- problem shape: focus-specific cards, then an editable sentence starter;
- moment when: four time-window cards;
- moment event: one short textarea with a focus/problem-specific example;
- feelings: eight emotion chips, maximum two, optional short note;
- boundaries: four boundary cards and “我可以先……” sentence starter;
- summary: deterministic reflection in an editable textarea, labeled as a draft the user controls.

Every continue action sends the whole updated draft to `saveHereDraft`; no local-only navigation is allowed. Back calls `goBackHere`.

In `LifeDesignSession`, render `GuidedHereFlow` while `checkpoint.hereGuidance` is non-null. Keep the existing `StepForm` for the remaining canonical steps. Show “第一阶段：看清现在 · n/9” instead of the eight-step counter inside the guided flow.

CSS requirements: coach message visually precedes the response card; selected options have visible text and border changes; focus states meet keyboard use; mobile has one-column choices; no screen contains the long three-plan form during this first-stage path.

- [ ] **Step 4: Run UI tests and typecheck**

Run: `pnpm --filter @life-design/web test -- life-design-session.test.tsx && pnpm typecheck`

Expected: UI tests and all workspace typechecks pass.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src apps/web/app/globals.css
git commit -m "feat: guide users through seeing their current reality"
```

### Task 5: Verify the golden path and document the slice

**Files:**
- Modify: `apps/web/e2e/full-journey.spec.ts`
- Modify: `README.md`

- [ ] **Step 1: Rewrite the E2E first-stage path before changing expectations**

The Playwright test must:

1. enter with no textbox visible;
2. start, set dashboard scores and continue;
3. close/reopen at focus selection and confirm exact recovery;
4. choose “工作” and “想换方向但不知道去哪”;
5. complete time, event, feelings and boundary steps;
6. edit and confirm the reflection;
7. assert arrival at `compass.workview`;
8. complete the existing remaining five canonical steps;
9. assert export still contains eight canonical responses and no credential-shaped text.

- [ ] **Step 2: Run E2E and observe the expected red/selector gaps**

Run: `pnpm test:e2e`

Expected: FAIL until all new accessible labels and recovery behavior match the test.

- [ ] **Step 3: Resolve only golden-path gaps and update README**

Document that Stage 1.1 guides the first stage locally, still requires no API Key, saves each micro-step, and leaves the remaining three stages on the existing mixed-form flow pending acceptance.

- [ ] **Step 4: Run full verification**

Run:

```bash
pnpm test
pnpm typecheck
pnpm test:e2e
pnpm --filter @life-design/web build
```

Expected: all tests pass, the single mobile E2E passes, and the production build exits 0.

- [ ] **Step 5: Perform mobile visual QA**

At 412×915, capture welcome, focus, concrete-event and reflection screens. Assert no horizontal overflow and no browser console errors. Confirm that the initial screen contains no blank textarea and each screenshot has one primary action.

- [ ] **Step 6: Commit and update the existing PR**

```bash
git add README.md apps/web/e2e/full-journey.spec.ts
git commit -m "test: verify guided first-stage journey"
git push origin stage-0-resumable-slice
```

Update PR #1 to describe Stage 1.1, its deterministic no-API fallback, the exact recovery contract, and the fresh verification counts. Keep the branch/worktree for user acceptance; do not merge.
