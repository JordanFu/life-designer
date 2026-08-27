# Local Codex Full Experience Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a resumable local Codex coaching moment after every major life-design input and generate a persistent downloadable final blueprint.

**Architecture:** The v4 core checkpoint owns coaching and blueprint state. The Web client always saves input before calling a localhost-only Next.js route; the route delegates to a small `@life-design/providers` Codex CLI adapter that runs ephemerally in an isolated read-only directory and validates structured output. Model results never drive canonical stage completion.

**Tech Stack:** TypeScript, React 19, Next.js 16 App Router, Zod 4, Dexie, Vitest, Playwright, Node `child_process`, local `codex exec`.

---

## File map

```text
packages/life-design-core/src/checkpoint.ts        v4 schemas and persisted AI state
packages/life-design-core/src/session.ts           coaching/blueprint transitions and migration
packages/life-design-core/src/session.test.ts      core transition coverage
packages/providers/src/contracts.ts                request/output schemas
packages/providers/src/prompts.ts                  bounded life-design prompts
packages/providers/src/codex-cli.ts                safe Codex process runner
packages/providers/src/codex-cli.test.ts           runner/provider failures
packages/providers/src/index.ts                    public server-only exports
apps/web/app/api/codex/coach/route.ts              localhost coach endpoint
apps/web/app/api/codex/blueprint/route.ts          localhost blueprint endpoint
apps/web/src/coach-moment.tsx                      loading/error/result/follow-up card
apps/web/src/blueprint-view.tsx                    generate/read/download/print UI
apps/web/src/use-life-design-session.ts             save-before-model orchestration
apps/web/src/life-design-session.tsx               route pending coach and completion UI
apps/web/app/globals.css                            coach and blueprint presentation
apps/web/e2e/full-journey.spec.ts                   mocked-model golden path
README.md                                           local Codex run and privacy notes
```

### Task 1: Model the v4 resumable coaching checkpoint

**Files:**
- Modify: `packages/life-design-core/src/checkpoint.ts`
- Modify: `packages/life-design-core/src/session.ts`
- Modify: `packages/life-design-core/src/session.test.ts`
- Modify: `packages/life-design-core/src/index.ts`

- [ ] **Step 1: Write failing migration and transition tests**

Add tests that assert:

```ts
const recorded = recordResponse(checkpoint, workview, now)
expect(recorded.coachPendingAfter).toBe('compass.workview')
expect(recorded.pendingOperation).toEqual({ type: 'advance-step', stepId: 'compass.workview' })

const withTurn = recordCoachTurn(recorded, {
  acknowledgement: '你把工作看成创造价值的方式。',
  insight: '你在自主与稳定之间可能存在拉扯。',
  followUp: '最近哪一次工作让你感到这两者同时出现？',
}, later)
expect(withTurn.currentStepId).toBe('compass.workview')

const advanced = completeCoachMoment(withTurn, '一次跨团队项目', latest)
expect(advanced.currentStepId).toBe('compass.lifeview')
expect(advanced.coachTurns.at(-1)?.followUpAnswer).toBe('一次跨团队项目')

const migrated = migrateCheckpoint(v3Checkpoint, now)
expect(migrated.schemaVersion).toBe(4)
expect(migrated.coachTurns).toEqual([])
expect(migrated.blueprint.status).toBe('idle')
```

Also cover `completeHereGuidance()` setting `coachPendingAfter` to `here.guided`, skipping a failed coach moment, blueprint begin/success/failure, and recovery of a persisted `generating` blueprint.

- [ ] **Step 2: Run core tests and verify the expected failure**

Run: `pnpm --filter @life-design/core test`

Expected: FAIL because v4 fields and transitions are not defined.

- [ ] **Step 3: Add v4 schemas**

Define and export:

```ts
export const coachAnchorSchema = z.union([stepIdSchema, z.literal('here.guided')])
export const coachTurnDraftSchema = z.object({
  acknowledgement: z.string().trim().min(10).max(800),
  insight: z.string().trim().min(10).max(1000),
  followUp: z.string().trim().min(5).max(500),
})
export const coachTurnSchema = coachTurnDraftSchema.extend({
  id: z.string().min(1),
  afterStepId: coachAnchorSchema,
  followUpAnswer: z.string().trim().max(2000).optional(),
  createdAt: z.string().datetime(),
})
export const blueprintStateSchema = z.object({
  status: z.enum(['idle', 'generating', 'complete', 'failed']),
  markdown: z.string().min(100).optional(),
  generatedAt: z.string().datetime().optional(),
  error: z.string().max(300).optional(),
})
```

Preserve `checkpointV2Schema` and the old v3 shape as `checkpointV3Schema`. Make `checkpointSchema` schema version 4 with `coachPendingAfter`, `coachTurns`, and `blueprint`.

- [ ] **Step 4: Implement deterministic transitions**

Add:

```ts
recordCoachTurn(checkpoint, draft, now): LifeDesignCheckpoint
completeCoachMoment(checkpoint, followUpAnswer, now): LifeDesignCheckpoint
skipCoachMoment(checkpoint, now): LifeDesignCheckpoint
beginBlueprint(checkpoint, now): LifeDesignCheckpoint
completeBlueprint(checkpoint, markdown, now): LifeDesignCheckpoint
failBlueprint(checkpoint, message, now): LifeDesignCheckpoint
recoverInterruptedBlueprint(checkpoint, now): LifeDesignCheckpoint
```

`recordResponse` sets `coachPendingAfter` without advancing. `recordCoachTurn` persists AI content but leaves the canonical cursor unchanged. `completeCoachMoment` stores the optional follow-up and invokes the existing advance transition only when an `advance-step` operation exists. `skipCoachMoment` clears the pending coach and also advances canonical state. `completeHereGuidance` advances to compass but leaves a `here.guided` coaching moment in front of the next form.

- [ ] **Step 5: Run focused and full core tests**

Run: `pnpm --filter @life-design/core test`

Expected: PASS.

- [ ] **Step 6: Commit the core slice**

```bash
git add packages/life-design-core
git commit -m "feat: persist resumable AI coaching state"
```

### Task 2: Add the isolated local Codex provider

**Files:**
- Create: `packages/providers/package.json`
- Create: `packages/providers/tsconfig.json`
- Create: `packages/providers/src/contracts.ts`
- Create: `packages/providers/src/prompts.ts`
- Create: `packages/providers/src/codex-cli.ts`
- Create: `packages/providers/src/codex-cli.test.ts`
- Create: `packages/providers/src/index.ts`
- Modify: `pnpm-lock.yaml`

- [ ] **Step 1: Write failing contract and runner tests**

Test a fake process executor rather than starting Codex in unit tests:

```ts
it('passes the prompt on stdin and uses an isolated ephemeral read-only run', async () => {
  const executor = vi.fn().mockResolvedValue(JSON.stringify(validCoachDraft))
  await createCodexCliProvider({ executor }).coach(validRequest)
  expect(executor).toHaveBeenCalledWith(expect.objectContaining({
    args: expect.arrayContaining([
      'exec', '--ephemeral', '--ignore-user-config', '--ignore-rules',
      '--sandbox', 'read-only', '--skip-git-repo-check', '--output-schema',
    ]),
    stdin: expect.stringContaining('人生设计教练'),
  }))
})
```

Cover timeout, non-zero exit, invalid JSON, invalid Schema, 256 KB request limit, and sanitized public errors.

- [ ] **Step 2: Run provider tests and verify failure**

Run: `pnpm --filter @life-design/providers test`

Expected: FAIL because the package does not exist.

- [ ] **Step 3: Add provider contracts and prompts**

Expose:

```ts
export const coachRequestSchema = z.object({
  anchor: coachAnchorSchema,
  checkpoint: checkpointSchema,
})
export const blueprintRequestSchema = z.object({ checkpoint: checkpointSchema })
export const blueprintDraftSchema = z.object({
  title: z.string().trim().min(2).max(100),
  markdown: z.string().trim().min(100).max(80_000),
})
```

`buildCoachPrompt()` asks for faithful acknowledgement, a tentative insight, and exactly one concrete lived-experience question. `buildBlueprintPrompt()` includes the seven required sections, equal Odyssey plans, evidence-only writing, and a no-diagnosis/no-decision boundary. Put stable methodology before checkpoint JSON.

- [ ] **Step 4: Implement the process executor**

Use `spawn('codex', args, { cwd: temporaryDirectory, shell: false, stdio: ['pipe', 'pipe', 'pipe'] })`. Write the prompt to stdin. Cap captured stdout/stderr, terminate after 120 seconds, read only the output file, validate it, and remove the temporary directory in `finally`. Never include checkpoint content or a full filesystem path in public error messages.

- [ ] **Step 5: Run tests and typecheck**

Run: `pnpm --filter @life-design/providers test`

Run: `pnpm --filter @life-design/providers typecheck`

Expected: PASS.

- [ ] **Step 6: Commit the provider slice**

```bash
git add packages/providers pnpm-lock.yaml
git commit -m "feat: add isolated local Codex provider"
```

### Task 3: Expose localhost-only Codex routes

**Files:**
- Create: `apps/web/app/api/codex/coach/route.ts`
- Create: `apps/web/app/api/codex/blueprint/route.ts`
- Create: `apps/web/src/local-codex-api.ts`
- Create: `apps/web/src/local-codex-api.test.ts`
- Modify: `apps/web/package.json`

- [ ] **Step 1: Write failing client/API behavior tests**

Assert that the client maps non-2xx responses to a friendly error and validates successful JSON. Test the route helper rejects requests unless `LIFE_DESIGN_LOCAL_CODEX=1` and caps request size before provider invocation.

- [ ] **Step 2: Run Web tests and verify failure**

Run: `pnpm --filter @life-design/web test`

Expected: FAIL because the local Codex API files do not exist.

- [ ] **Step 3: Implement the two server routes**

Both routes must:

```ts
if (process.env.LIFE_DESIGN_LOCAL_CODEX !== '1') {
  return Response.json({ error: '本地 Codex 未启用' }, { status: 503 })
}
```

Read at most 256 KB, validate with the provider request schema, call the provider, and return only validated model content. Use status 400 for invalid input, 503 for missing Codex/auth, and 504 for timeout.

- [ ] **Step 4: Implement the typed browser client**

```ts
export async function requestCoach(input: CoachRequest): Promise<CoachTurnDraft>
export async function requestBlueprint(input: BlueprintRequest): Promise<BlueprintDraft>
```

Use `fetch`, parse JSON once, validate output, and surface a concise Chinese error without echoing the checkpoint.

- [ ] **Step 5: Run Web tests and typecheck**

Run: `pnpm --filter @life-design/web test`

Run: `pnpm --filter @life-design/web typecheck`

Expected: PASS.

- [ ] **Step 6: Commit the API slice**

```bash
git add apps/web/app/api apps/web/src/local-codex-api* apps/web/package.json pnpm-lock.yaml
git commit -m "feat: expose localhost Codex coaching routes"
```

### Task 4: Insert resumable AI coaching moments

**Files:**
- Create: `apps/web/src/coach-moment.tsx`
- Create: `apps/web/src/coach-moment.test.tsx`
- Modify: `apps/web/src/use-life-design-session.ts`
- Modify: `apps/web/src/use-life-design-session.test.tsx`
- Modify: `apps/web/src/life-design-session.tsx`
- Modify: `apps/web/src/life-design-session.test.tsx`
- Modify: `apps/web/app/globals.css`

- [ ] **Step 1: Write failing orchestration tests**

Mock `requestCoach` and verify this ordering:

```ts
await result.current.submitResponse(workview)
expect(repository.save).toHaveBeenCalledBefore(requestCoachMock)
expect(result.current.checkpoint?.currentStepId).toBe('compass.workview')
expect(result.current.checkpoint?.coachPendingAfter).toBe('compass.workview')
```

Then verify a model failure preserves the pending state; retry does not duplicate the response; saving a coach turn still does not advance; “补充并继续” stores the answer and advances; “先继续使用本地流程” advances with no fake AI content.

- [ ] **Step 2: Run Web tests and verify failure**

Run: `pnpm --filter @life-design/web test`

Expected: FAIL on the new coaching expectations.

- [ ] **Step 3: Refactor the session hook around explicit actions**

Return:

```ts
coachStatus: 'idle' | 'loading' | 'ready' | 'error'
coachError: string | null
generateCoachMoment(): Promise<boolean>
continueAfterCoach(followUpAnswer?: string): Promise<boolean>
skipCoachMoment(): Promise<boolean>
```

Do not call the network from core transitions. `submitResponse` and `completeHere` stop after saving a checkpoint containing `coachPendingAfter`. `generateCoachMoment` calls the API only after that persisted state exists, then saves `recordCoachTurn`. On initial load, never auto-advance an operation that still has a coach pending.

- [ ] **Step 4: Build the coach card**

The component automatically calls `onGenerate` once when no saved turn exists. Render:

- saved/loading reassurance;
- acknowledgement, insight, and one follow-up;
- optional textarea;
- continue and skip actions;
- retry and local-flow fallback on error.

Use an internal ref to avoid duplicate development-mode calls.

- [ ] **Step 5: Route pending coaching before the next form**

In `LifeDesignSession`, prioritize `checkpoint.coachPendingAfter` over `hereGuidance`, `step`, and completion. Pass the most recent matching turn into `CoachMoment`. Add the disclosure: “你的本次人生设计素材会发送给这台电脑当前登录的 Codex，用于生成回应和蓝图。”

- [ ] **Step 6: Run tests and commit**

Run: `pnpm --filter @life-design/web test`

Run: `pnpm --filter @life-design/web typecheck`

Expected: PASS.

```bash
git add apps/web/src apps/web/app/globals.css
git commit -m "feat: add resumable Codex coaching moments"
```

### Task 5: Generate, persist, and export the blueprint

**Files:**
- Create: `apps/web/src/blueprint-view.tsx`
- Create: `apps/web/src/blueprint-view.test.tsx`
- Modify: `apps/web/src/use-life-design-session.ts`
- Modify: `apps/web/src/use-life-design-session.test.tsx`
- Modify: `apps/web/src/life-design-session.tsx`
- Modify: `apps/web/app/globals.css`

- [ ] **Step 1: Write failing blueprint tests**

Verify generate ordering (`beginBlueprint` saved before request), success persistence, failure persistence, interrupted-generation recovery after remount, regeneration preserving the old Markdown until success, filename `人生设计蓝图.md`, and no Codex credential strings in exported content.

- [ ] **Step 2: Run tests and verify failure**

Run: `pnpm --filter @life-design/web test`

Expected: FAIL because the blueprint actions and view do not exist.

- [ ] **Step 3: Add hook actions**

Return:

```ts
blueprintStatus: 'idle' | 'generating' | 'complete' | 'failed'
generateBlueprint(): Promise<boolean>
downloadBlueprint(): void
printBlueprint(): void
```

Persist `beginBlueprint` first, call `/api/codex/blueprint`, then atomically save `completeBlueprint`. On failure save `failBlueprint`. On load recover stale `generating` to `failed` without deleting any prior Markdown.

- [ ] **Step 4: Build the blueprint view**

Render an honest pre-generation state, progress state, retryable failure, and readable Markdown-like article. Offer “下载 Markdown”“打印/保存 PDF”“重新生成”“导出结构化素材”. Do not render raw Markdown as unsafe HTML.

- [ ] **Step 5: Run tests and commit**

Run: `pnpm --filter @life-design/web test`

Run: `pnpm --filter @life-design/web typecheck`

Expected: PASS.

```bash
git add apps/web/src apps/web/app/globals.css
git commit -m "feat: generate persistent life design blueprint"
```

### Task 6: Prove the complete journey with fake and real Codex

**Files:**
- Modify: `apps/web/e2e/full-journey.spec.ts`
- Modify: `README.md`

- [ ] **Step 1: Extend the Playwright golden path**

Intercept `/api/codex/coach` with distinct fixture responses and `/api/codex/blueprint` with a seven-section Markdown fixture. Complete the existing nine guided micro-steps and remaining five forms, continue through each coach card, refresh once while a coach is pending, generate the blueprint, refresh, and assert the persisted title and download event.

- [ ] **Step 2: Run the full automated verification**

Run: `pnpm test`

Run: `pnpm typecheck`

Run: `pnpm --filter @life-design/web build`

Run: `pnpm test:e2e`

Expected: all PASS.

- [ ] **Step 3: Document local startup and privacy**

Document:

```bash
LIFE_DESIGN_LOCAL_CODEX=1 pnpm dev
```

Explain that the local server uses the currently logged-in Codex account, answers are sent to OpenAI through Codex, the CLI runs ephemerally with a read-only sandbox, no API Key is exposed to the browser, and this adapter is not the public-hosting architecture.

- [ ] **Step 4: Run a real provider smoke test**

Start the app with `LIFE_DESIGN_LOCAL_CODEX=1`. Submit a small de-identified checkpoint to `/api/codex/coach` and assert the three structured fields are non-empty. Submit a complete realistic fixture to `/api/codex/blueprint` and assert all seven required headings exist. Record actual latency and any model failure without exposing the fixture content in logs.

- [ ] **Step 5: Perform visible browser acceptance checks**

At 412×915 and desktop width verify: no horizontal overflow, one primary action per state, saved-before-model language, retry/skip behavior, blueprint readability, refresh recovery, Markdown download, and no console errors.

- [ ] **Step 6: Commit and update the PR**

```bash
git add README.md apps/web/e2e/full-journey.spec.ts
git commit -m "test: verify complete local Codex experience"
git push
```

Update PR #1 with the new golden path, real Codex smoke evidence, test counts, current local-only boundary, and “ready for acceptance” status.
