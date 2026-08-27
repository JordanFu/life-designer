# Stage 0 Resumable Slice Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a mobile-first local Web slice in which a user answers three life-design questions, closes the page, resumes at the exact checkpoint, and exports the checkpoint without exposing an API key.

**Architecture:** Add a small pnpm workspace beside the upstream Agent/CLI files. A framework-independent core package owns the versioned state machine; a checkpoint package owns IndexedDB persistence; the Next.js app only renders and coordinates them. Stage 0 deliberately uses deterministic questions and no model call so recovery semantics are proven before model, payment, cloud storage, or full-report complexity is introduced.

**Tech Stack:** TypeScript, Next.js 16, React 19, Zod 4, Dexie 4, Vitest, Testing Library, Playwright, pnpm 10.

---

## File map

```text
package.json                                      workspace commands only
pnpm-workspace.yaml                               workspace package discovery
tsconfig.base.json                                shared strict TypeScript settings
.gitignore                                        generated web/test artifacts
packages/life-design-core/package.json            pure domain package
packages/life-design-core/tsconfig.json            package-local type-check boundary
packages/life-design-core/src/checkpoint.ts       schemas and types
packages/life-design-core/src/session.ts          three-question state transitions
packages/life-design-core/src/index.ts            public exports
packages/life-design-core/src/session.test.ts     state-machine tests
packages/checkpoint/package.json                  persistence package
packages/checkpoint/tsconfig.json                  package-local type-check boundary
packages/checkpoint/src/repository.ts              IndexedDB repository
packages/checkpoint/src/index.ts                  public exports
packages/checkpoint/src/repository.test.ts         persistence/revision tests
apps/web/package.json                             web dependencies and scripts
apps/web/next-env.d.ts                            Next.js ambient types
apps/web/next.config.ts                           strict Next configuration
apps/web/tsconfig.json                            Next TypeScript settings
apps/web/vitest.config.ts                         DOM unit-test configuration
apps/web/playwright.config.ts                     local E2E server configuration
apps/web/app/layout.tsx                           metadata and document shell
apps/web/app/page.tsx                             page composition
apps/web/app/globals.css                          mobile-first visual system
apps/web/src/use-life-design-session.ts           durable UI controller
apps/web/src/use-life-design-session.test.tsx     controller tests
apps/web/src/life-design-session.tsx               three-question experience
apps/web/e2e/resume.spec.ts                       exact-breakpoint golden path
apps/web/e2e/export.spec.ts                       checkpoint export safety test
```

## Task 1: Create the workspace and test harness

**Files:**
- Create: `package.json`
- Create: `pnpm-workspace.yaml`
- Create: `tsconfig.base.json`
- Create: `.gitignore`
- Create: `apps/web/package.json`
- Create: `apps/web/next-env.d.ts`
- Create: `apps/web/next.config.ts`
- Create: `apps/web/tsconfig.json`
- Create: `apps/web/vitest.config.ts`
- Create: `apps/web/playwright.config.ts`

- [ ] **Step 1: Write the workspace manifests**

Create `package.json`:

```json
{
  "name": "life-design-studio",
  "private": true,
  "packageManager": "pnpm@10.32.1",
  "scripts": {
    "dev": "pnpm --filter @life-design/web dev",
    "test": "pnpm -r test",
    "typecheck": "pnpm -r typecheck",
    "test:e2e": "pnpm --filter @life-design/web test:e2e"
  }
}
```

Create `pnpm-workspace.yaml`:

```yaml
packages:
  - apps/*
  - packages/*
```

Create `tsconfig.base.json`:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["DOM", "DOM.Iterable", "ES2022"],
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "skipLibCheck": true,
    "esModuleInterop": true,
    "resolveJsonModule": true
  }
}
```

Create `.gitignore`:

```gitignore
node_modules/
.next/
coverage/
playwright-report/
test-results/
*.tsbuildinfo
```

- [ ] **Step 2: Write the web package configuration**

Create `apps/web/package.json`:

```json
{
  "name": "@life-design/web",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "test": "vitest run --passWithNoTests",
    "typecheck": "tsc --noEmit",
    "test:e2e": "playwright test"
  },
  "dependencies": {
    "@life-design/checkpoint": "workspace:*",
    "@life-design/core": "workspace:*",
    "next": "16.2.10",
    "react": "19.2.7",
    "react-dom": "19.2.7"
  },
  "devDependencies": {
    "@playwright/test": "^1.61.1",
    "@testing-library/react": "^16.3.0",
    "@types/node": "^24.0.0",
    "@types/react": "^19.2.0",
    "@types/react-dom": "^19.2.0",
    "@vitejs/plugin-react": "^5.0.0",
    "jsdom": "^27.0.0",
    "typescript": "^5.6.3",
    "vite-tsconfig-paths": "^5.1.4",
    "vitest": "^4.0.0"
  }
}
```

Create `apps/web/next.config.ts`:

```ts
import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  reactStrictMode: true,
  transpilePackages: ['@life-design/core', '@life-design/checkpoint'],
}

export default nextConfig
```

Create `apps/web/next-env.d.ts`:

```ts
/// <reference types="next" />
/// <reference types="next/image-types/global" />
```

Create `apps/web/tsconfig.json`:

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "jsx": "preserve",
    "noEmit": true,
    "incremental": true,
    "plugins": [{ "name": "next" }],
    "paths": { "@/*": ["./*"] }
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules"]
}
```

Create `apps/web/vitest.config.ts`:

```ts
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'
import tsconfigPaths from 'vite-tsconfig-paths'

export default defineConfig({
  plugins: [react(), tsconfigPaths()],
  test: { environment: 'jsdom', globals: true },
})
```

Create `apps/web/playwright.config.ts`:

```ts
import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './e2e',
  use: { baseURL: 'http://127.0.0.1:3010', trace: 'retain-on-failure' },
  projects: [{ name: 'mobile-chrome', use: devices['Pixel 7'] }],
  webServer: {
    command: 'pnpm dev --port 3010',
    url: 'http://127.0.0.1:3010',
    reuseExistingServer: !process.env.CI,
  },
})
```

- [ ] **Step 3: Install the locked dependency graph**

Run: `pnpm install`

Expected: exit code 0 and a new root `pnpm-lock.yaml`.

- [ ] **Step 4: Verify workspace discovery**

Run: `pnpm list -r --depth -1`

Expected: the output includes `life-design-studio` and `@life-design/web`.

- [ ] **Step 5: Commit the harness**

```bash
git add package.json pnpm-workspace.yaml tsconfig.base.json .gitignore pnpm-lock.yaml apps/web
git commit -m "chore: scaffold life design web workspace"
```

## Task 2: Define the versioned life-design checkpoint

**Files:**
- Create: `packages/life-design-core/package.json`
- Create: `packages/life-design-core/tsconfig.json`
- Create: `packages/life-design-core/src/checkpoint.ts`
- Create: `packages/life-design-core/src/session.ts`
- Create: `packages/life-design-core/src/index.ts`
- Create: `packages/life-design-core/src/session.test.ts`

- [ ] **Step 1: Write the failing state-machine tests**

Create `packages/life-design-core/package.json`:

```json
{
  "name": "@life-design/core",
  "private": true,
  "type": "module",
  "exports": "./src/index.ts",
  "scripts": {
    "test": "vitest run",
    "typecheck": "tsc --noEmit --project tsconfig.json"
  },
  "dependencies": { "zod": "^4.4.3" },
  "devDependencies": { "typescript": "^5.6.3", "vitest": "^4.0.0" }
}
```

Create `packages/life-design-core/tsconfig.json`:

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": { "noEmit": true },
  "include": ["src/**/*.ts"]
}
```

Create `packages/life-design-core/src/session.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import {
  advanceAfterSavedAnswer,
  createCheckpoint,
  recordAnswer,
} from './session'

describe('life-design session', () => {
  it('starts at the first question without answers', () => {
    const state = createCheckpoint('session-1', '2026-08-27T08:00:00.000Z')
    expect(state.currentQuestionId).toBe('here.dashboard')
    expect(state.answers).toEqual([])
    expect(state.revision).toBe(1)
  })

  it('records the exact user answer before changing the question', () => {
    const initial = createCheckpoint('session-1', '2026-08-27T08:00:00.000Z')
    const saved = recordAnswer(initial, '工作 4 分，爱 8 分。', '2026-08-27T08:01:00.000Z')
    expect(saved.currentQuestionId).toBe('here.dashboard')
    expect(saved.answers[0]?.text).toBe('工作 4 分，爱 8 分。')
    expect(saved.pendingOperation?.type).toBe('advance-question')
  })

  it('advances only from a durably recorded answer', () => {
    const initial = createCheckpoint('session-1', '2026-08-27T08:00:00.000Z')
    expect(() => advanceAfterSavedAnswer(initial, '2026-08-27T08:01:30.000Z')).toThrow(
      'No saved answer is waiting to advance',
    )
    const saved = recordAnswer(initial, '工作让我最焦虑。', '2026-08-27T08:01:00.000Z')
    const advanced = advanceAfterSavedAnswer(saved, '2026-08-27T08:01:30.000Z')
    expect(advanced.currentQuestionId).toBe('here.primary-problem')
    expect(advanced.pendingOperation).toBeNull()
  })
})
```

- [ ] **Step 2: Run the tests to verify failure**

Run: `pnpm --filter @life-design/core test`

Expected: FAIL because `./session` does not exist.

- [ ] **Step 3: Implement the schemas**

Create `packages/life-design-core/src/checkpoint.ts`:

```ts
import { z } from 'zod'

export const questionIdSchema = z.enum([
  'here.dashboard',
  'here.primary-problem',
  'here.why-now',
])

export const answerSchema = z.object({
  questionId: questionIdSchema,
  text: z.string().trim().min(1),
  answeredAt: z.string().datetime(),
})

export const checkpointSchema = z.object({
  schemaVersion: z.literal(1),
  sessionId: z.string().min(1),
  revision: z.number().int().positive(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  stage: z.literal('here'),
  currentQuestionId: questionIdSchema.nullable(),
  completedQuestionIds: z.array(questionIdSchema),
  answers: z.array(answerSchema),
  pendingOperation: z
    .object({ type: z.literal('advance-question'), questionId: questionIdSchema })
    .nullable(),
})

export type QuestionId = z.infer<typeof questionIdSchema>
export type LifeDesignCheckpoint = z.infer<typeof checkpointSchema>
```

- [ ] **Step 4: Implement the minimal state machine**

Create `packages/life-design-core/src/session.ts`:

```ts
import {
  checkpointSchema,
  type LifeDesignCheckpoint,
  type QuestionId,
} from './checkpoint'

export const questions: ReadonlyArray<{ id: QuestionId; text: string }> = [
  {
    id: 'here.dashboard',
    text: '如果给健康、工作、娱乐和爱各打 0 到 10 分，你会怎么打？哪一项最亮红灯？',
  },
  {
    id: 'here.primary-problem',
    text: '此刻你最想解决、也最让你焦虑的那个人生问题是什么？',
  },
  {
    id: 'here.why-now',
    text: '最近哪一件具体的事，让这个问题变得不能再忽略？',
  },
]

export function createCheckpoint(sessionId: string, now: string): LifeDesignCheckpoint {
  return checkpointSchema.parse({
    schemaVersion: 1,
    sessionId,
    revision: 1,
    createdAt: now,
    updatedAt: now,
    stage: 'here',
    currentQuestionId: questions[0]?.id ?? null,
    completedQuestionIds: [],
    answers: [],
    pendingOperation: null,
  })
}

export function recordAnswer(
  checkpoint: LifeDesignCheckpoint,
  text: string,
  now: string,
): LifeDesignCheckpoint {
  if (!checkpoint.currentQuestionId) throw new Error('Session is complete')
  return checkpointSchema.parse({
    ...checkpoint,
    revision: checkpoint.revision + 1,
    updatedAt: now,
    answers: [
      ...checkpoint.answers,
      { questionId: checkpoint.currentQuestionId, text, answeredAt: now },
    ],
    pendingOperation: {
      type: 'advance-question',
      questionId: checkpoint.currentQuestionId,
    },
  })
}

export function advanceAfterSavedAnswer(
  checkpoint: LifeDesignCheckpoint,
  now: string,
): LifeDesignCheckpoint {
  if (!checkpoint.pendingOperation) {
    throw new Error('No saved answer is waiting to advance')
  }
  const completedId = checkpoint.pendingOperation.questionId
  const index = questions.findIndex((question) => question.id === completedId)
  return checkpointSchema.parse({
    ...checkpoint,
    revision: checkpoint.revision + 1,
    updatedAt: now,
    currentQuestionId: questions[index + 1]?.id ?? null,
    completedQuestionIds: [...checkpoint.completedQuestionIds, completedId],
    pendingOperation: null,
  })
}
```

Create `packages/life-design-core/src/index.ts`:

```ts
export * from './checkpoint'
export * from './session'
```

- [ ] **Step 5: Run tests and type checking**

Run: `pnpm --filter @life-design/core test && pnpm --filter @life-design/core typecheck`

Expected: 3 tests PASS and TypeScript exits 0.

- [ ] **Step 6: Commit the domain model**

```bash
git add packages/life-design-core
git commit -m "feat: add versioned life design checkpoint"
```

## Task 3: Persist checkpoints with stale-write protection

**Files:**
- Create: `packages/checkpoint/package.json`
- Create: `packages/checkpoint/tsconfig.json`
- Create: `packages/checkpoint/src/repository.ts`
- Create: `packages/checkpoint/src/index.ts`
- Create: `packages/checkpoint/src/repository.test.ts`

- [ ] **Step 1: Write the failing repository tests**

Create `packages/checkpoint/package.json`:

```json
{
  "name": "@life-design/checkpoint",
  "private": true,
  "type": "module",
  "exports": "./src/index.ts",
  "scripts": {
    "test": "vitest run",
    "typecheck": "tsc --noEmit --project tsconfig.json"
  },
  "dependencies": {
    "@life-design/core": "workspace:*",
    "dexie": "^4.2.0"
  },
  "devDependencies": {
    "fake-indexeddb": "^6.2.0",
    "typescript": "^5.6.3",
    "vitest": "^4.0.0"
  }
}
```

Create `packages/checkpoint/tsconfig.json`:

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": { "noEmit": true },
  "include": ["src/**/*.ts"]
}
```

Create `packages/checkpoint/src/repository.test.ts`:

```ts
import 'fake-indexeddb/auto'
import { afterEach, describe, expect, it } from 'vitest'
import { createCheckpoint } from '@life-design/core'
import { CheckpointRepository } from './repository'

describe('CheckpointRepository', () => {
  const repositories: CheckpointRepository[] = []

  afterEach(async () => {
    await Promise.all(repositories.map((repository) => repository.deleteDatabase()))
    repositories.length = 0
  })

  it('loads the most recently saved checkpoint after reopening', async () => {
    const first = new CheckpointRepository('restore-test')
    const checkpoint = createCheckpoint('session-1', '2026-08-27T08:00:00.000Z')
    await first.save(checkpoint)
    first.close()

    const reopened = new CheckpointRepository('restore-test')
    repositories.push(reopened)
    expect(await reopened.load('session-1')).toEqual(checkpoint)
  })

  it('rejects a stale revision instead of overwriting newer data', async () => {
    const repository = new CheckpointRepository('revision-test')
    repositories.push(repository)
    const revisionOne = createCheckpoint('session-1', '2026-08-27T08:00:00.000Z')
    await repository.save({ ...revisionOne, revision: 2 })
    await expect(repository.save(revisionOne)).rejects.toThrow('Stale checkpoint revision')
  })
})
```

- [ ] **Step 2: Run the tests to verify failure**

Run: `pnpm install && pnpm --filter @life-design/checkpoint test`

Expected: FAIL because `./repository` does not exist.

- [ ] **Step 3: Implement the IndexedDB repository**

Create `packages/checkpoint/src/repository.ts`:

```ts
import Dexie, { type EntityTable } from 'dexie'
import {
  checkpointSchema,
  type LifeDesignCheckpoint,
} from '@life-design/core'

export class CheckpointRepository extends Dexie {
  checkpoints!: EntityTable<LifeDesignCheckpoint, 'sessionId'>

  constructor(name = 'life-design-studio') {
    super(name)
    this.version(1).stores({ checkpoints: 'sessionId, updatedAt, revision' })
  }

  async save(checkpoint: LifeDesignCheckpoint): Promise<void> {
    const valid = checkpointSchema.parse(checkpoint)
    await this.transaction('rw', this.checkpoints, async () => {
      const current = await this.checkpoints.get(valid.sessionId)
      if (current && current.revision >= valid.revision) {
        throw new Error('Stale checkpoint revision')
      }
      await this.checkpoints.put(valid)
    })
  }

  async load(sessionId: string): Promise<LifeDesignCheckpoint | null> {
    const value = await this.checkpoints.get(sessionId)
    return value ? checkpointSchema.parse(value) : null
  }

  async deleteSession(sessionId: string): Promise<void> {
    await this.checkpoints.delete(sessionId)
  }

  async deleteDatabase(): Promise<void> {
    this.close()
    await Dexie.delete(this.name)
  }
}
```

Create `packages/checkpoint/src/index.ts`:

```ts
export * from './repository'
```

- [ ] **Step 4: Run repository and workspace tests**

Run: `pnpm --filter @life-design/checkpoint test && pnpm test`

Expected: 2 repository tests and all core tests PASS.

- [ ] **Step 5: Commit persistence**

```bash
git add packages/checkpoint pnpm-lock.yaml
git commit -m "feat: persist checkpoints in indexeddb"
```

## Task 4: Build the durable session controller

**Files:**
- Create: `apps/web/src/use-life-design-session.ts`
- Create: `apps/web/src/use-life-design-session.test.tsx`

- [ ] **Step 1: Write the failing controller test**

Create `apps/web/src/use-life-design-session.test.tsx`:

```tsx
import 'fake-indexeddb/auto'
import { act, renderHook, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { CheckpointRepository } from '@life-design/checkpoint'
import { createCheckpoint, recordAnswer } from '@life-design/core'
import { useLifeDesignSession } from './use-life-design-session'

describe('useLifeDesignSession', () => {
  const repositories: CheckpointRepository[] = []

  afterEach(async () => {
    await Promise.all(repositories.map((repository) => repository.deleteDatabase()))
    repositories.length = 0
    localStorage.clear()
  })

  it('restores the exact next question after a new hook instance mounts', async () => {
    const repository = new CheckpointRepository('hook-restore')
    repositories.push(repository)
    const first = renderHook(() => useLifeDesignSession(repository))
    await waitFor(() => expect(first.result.current.status).toBe('ready'))

    await act(async () => first.result.current.answer('健康 6，工作 3，娱乐 4，爱 8。'))
    expect(first.result.current.question?.id).toBe('here.primary-problem')
    first.unmount()

    const second = renderHook(() => useLifeDesignSession(repository))
    await waitFor(() => expect(second.result.current.status).toBe('ready'))
    expect(second.result.current.question?.id).toBe('here.primary-problem')
    expect(second.result.current.checkpoint?.answers[0]?.text).toBe(
      '健康 6，工作 3，娱乐 4，爱 8。',
    )
  })

  it('finishes a saved pending advance after a crash', async () => {
    const repository = new CheckpointRepository('hook-pending')
    repositories.push(repository)
    const initial = createCheckpoint('session-pending', '2026-08-27T08:00:00.000Z')
    const recorded = recordAnswer(initial, '工作 3 分。', '2026-08-27T08:01:00.000Z')
    await repository.save(recorded)
    localStorage.setItem('life-design-active-session', recorded.sessionId)

    const restored = renderHook(() => useLifeDesignSession(repository))
    await waitFor(() => expect(restored.result.current.status).toBe('ready'))
    expect(restored.result.current.question?.id).toBe('here.primary-problem')
    expect(restored.result.current.checkpoint?.answers).toHaveLength(1)
  })
})
```

Add `"fake-indexeddb": "^6.2.0"` to `apps/web` devDependencies.

- [ ] **Step 2: Run the controller test to verify failure**

Run: `pnpm install && pnpm --filter @life-design/web test -- use-life-design-session.test.tsx`

Expected: FAIL because the hook does not exist.

- [ ] **Step 3: Implement write-before-advance behavior**

Create `apps/web/src/use-life-design-session.ts`:

```ts
'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { CheckpointRepository } from '@life-design/checkpoint'
import {
  advanceAfterSavedAnswer,
  createCheckpoint,
  questions,
  recordAnswer,
  type LifeDesignCheckpoint,
} from '@life-design/core'

const SESSION_KEY = 'life-design-active-session'

export function useLifeDesignSession(repository: CheckpointRepository) {
  const [checkpoint, setCheckpoint] = useState<LifeDesignCheckpoint | null>(null)
  const [status, setStatus] = useState<'loading' | 'ready' | 'saving' | 'error'>('loading')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    async function load() {
      const existingId = localStorage.getItem(SESSION_KEY)
      const restored = existingId ? await repository.load(existingId) : null
      let next = restored ?? createCheckpoint(crypto.randomUUID(), new Date().toISOString())
      if (!restored) await repository.save(next)
      if (next.pendingOperation) {
        next = advanceAfterSavedAnswer(next, new Date().toISOString())
        await repository.save(next)
      }
      localStorage.setItem(SESSION_KEY, next.sessionId)
      if (!cancelled) {
        setCheckpoint(next)
        setStatus('ready')
      }
    }
    load().catch((cause: unknown) => {
      if (!cancelled) {
        setError(cause instanceof Error ? cause.message : '无法读取进度')
        setStatus('error')
      }
    })
    return () => {
      cancelled = true
    }
  }, [repository])

  const answer = useCallback(
    async (text: string) => {
      if (!checkpoint) return
      setStatus('saving')
      setError(null)
      try {
        const recorded = recordAnswer(checkpoint, text, new Date().toISOString())
        await repository.save(recorded)
        setCheckpoint(recorded)
        const advanced = advanceAfterSavedAnswer(recorded, new Date().toISOString())
        await repository.save(advanced)
        setCheckpoint(advanced)
        setStatus('ready')
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : '保存失败')
        setStatus('error')
      }
    },
    [checkpoint, repository],
  )

  const exportCheckpoint = useCallback(() => {
    if (!checkpoint) return
    const blob = new Blob([JSON.stringify(checkpoint, null, 2)], {
      type: 'application/json',
    })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.download = `life-design-checkpoint-${checkpoint.sessionId}.json`
    link.click()
    URL.revokeObjectURL(link.href)
  }, [checkpoint])

  const question = useMemo(
    () => questions.find((item) => item.id === checkpoint?.currentQuestionId) ?? null,
    [checkpoint?.currentQuestionId],
  )

  return { checkpoint, question, status, error, answer, exportCheckpoint }
}
```

- [ ] **Step 4: Run the controller test and type checking**

Run: `pnpm --filter @life-design/web test -- use-life-design-session.test.tsx && pnpm typecheck`

Expected: the restore test PASSes and all packages type-check.

- [ ] **Step 5: Commit the controller**

```bash
git add apps/web/src apps/web/package.json pnpm-lock.yaml
git commit -m "feat: restore durable life design sessions"
```

## Task 5: Render the three-question mobile experience

**Files:**
- Create: `apps/web/app/layout.tsx`
- Create: `apps/web/app/page.tsx`
- Create: `apps/web/app/globals.css`
- Create: `apps/web/src/life-design-session.tsx`

- [ ] **Step 1: Create the document shell**

Create `apps/web/app/layout.tsx`:

```tsx
import type { Metadata } from 'next'
import type { ReactNode } from 'react'
import './globals.css'

export const metadata: Metadata = {
  title: 'Life Design Studio',
  description: '一次可以暂停、可以回来的人生设计对话。',
}

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  )
}
```

Create `apps/web/app/page.tsx`:

```tsx
import { LifeDesignSession } from '@/src/life-design-session'

export default function HomePage() {
  return <LifeDesignSession />
}
```

- [ ] **Step 2: Create the session component**

Create `apps/web/src/life-design-session.tsx`:

```tsx
'use client'

import { FormEvent, useMemo, useState } from 'react'
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
    setText('')
    await answer(value)
  }

  if (status === 'loading') return <main className="shell">正在找回你的进度…</main>

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
```

- [ ] **Step 3: Add the mobile-first visual system**

Create `apps/web/app/globals.css`:

```css
:root {
  color-scheme: light;
  --paper: #f5f0e7;
  --ink: #1f2925;
  --muted: #68736d;
  --line: #d8d2c7;
  --accent: #375f50;
  --card: rgba(255, 255, 255, 0.72);
}

* { box-sizing: border-box; }
body {
  margin: 0;
  background: var(--paper);
  color: var(--ink);
  font-family: ui-sans-serif, system-ui, "PingFang SC", "Microsoft YaHei", sans-serif;
}
button, textarea { font: inherit; }
.shell { width: min(100% - 32px, 760px); margin: 0 auto; padding: 28px 0 64px; }
.topbar { display: flex; justify-content: space-between; gap: 20px; align-items: start; }
.eyebrow { margin: 0 0 8px; color: var(--muted); font-size: 12px; letter-spacing: .15em; }
h1 { margin: 0; font-family: ui-serif, "Songti SC", serif; font-size: clamp(28px, 8vw, 48px); }
.saved { color: var(--muted); font-size: 13px; white-space: nowrap; }
.progress { display: grid; grid-template-columns: repeat(4, 1fr); padding: 0; margin: 32px 0; list-style: none; border-top: 1px solid var(--line); }
.progress li { padding-top: 10px; color: var(--muted); font-size: 12px; }
.progress .active { border-top: 3px solid var(--accent); margin-top: -2px; color: var(--accent); font-weight: 700; }
.conversation { display: grid; gap: 14px; }
.question, .answer { border: 1px solid var(--line); border-radius: 20px; padding: 20px; }
.question { background: var(--card); }
.question p { margin: 0 0 8px; color: var(--accent); }
.question h2 { margin: 0; font: 500 22px/1.45 ui-serif, "Songti SC", serif; }
.answer { justify-self: end; max-width: 88%; background: var(--accent); color: white; line-height: 1.7; }
.composer { display: grid; gap: 10px; margin-top: 20px; }
.composer label { font-size: 13px; color: var(--muted); }
textarea { width: 100%; resize: vertical; border: 1px solid var(--line); border-radius: 16px; background: white; padding: 14px; color: var(--ink); }
textarea:focus { outline: 3px solid rgba(55, 95, 80, .16); border-color: var(--accent); }
button { min-height: 48px; border: 0; border-radius: 999px; padding: 0 22px; background: var(--accent); color: white; cursor: pointer; }
button:disabled { cursor: not-allowed; opacity: .5; }
.error { color: #9b3d32; }
.export { margin-top: 20px; width: 100%; }
@media (min-width: 720px) { .shell { padding-top: 56px; } .question, .answer { padding: 26px; } }
```

- [ ] **Step 4: Run the app and inspect the default mobile viewport**

Run: `pnpm dev`

Expected: `http://localhost:3000` shows one question, a four-stage progress line, a textarea, and an “已自动保存” indicator without horizontal scrolling at 412×915.

- [ ] **Step 5: Build and commit the interface**

Run: `pnpm --filter @life-design/web build`

Expected: Next production build exits 0.

```bash
git add apps/web/app apps/web/src/life-design-session.tsx
git commit -m "feat: add mobile life design conversation"
```

## Task 6: Prove resume and safe export end to end

**Files:**
- Create: `apps/web/e2e/resume.spec.ts`
- Create: `apps/web/e2e/export.spec.ts`

- [ ] **Step 1: Write the resume golden-path test**

Create `apps/web/e2e/resume.spec.ts`:

```ts
import { expect, test } from '@playwright/test'

test('returns to the exact next question after closing the page', async ({ context, page }) => {
  await page.goto('/')
  await page.getByLabel('你的回答').fill('健康 6，工作 3，娱乐 4，爱 8。')
  await page.getByRole('button', { name: '保存并继续' }).click()
  await expect(page.getByRole('heading', { name: /此刻你最想解决/ })).toBeVisible()

  await page.close()
  const resumed = await context.newPage()
  await resumed.goto('/')

  await expect(resumed.getByText('健康 6，工作 3，娱乐 4，爱 8。')).toBeVisible()
  await expect(resumed.getByRole('heading', { name: /此刻你最想解决/ })).toBeVisible()
  await expect(resumed.getByText(/如果给健康/)).toHaveCount(0)
})
```

- [ ] **Step 2: Write the export safety test**

Create `apps/web/e2e/export.spec.ts`:

```ts
import { expect, test } from '@playwright/test'
import { readFile } from 'node:fs/promises'

test('exports three answers without credentials', async ({ page }) => {
  await page.goto('/')
  const answers = ['健康 6，工作 3，娱乐 4，爱 8。', '工作让我最焦虑。', '昨天又一次加班到深夜。']
  for (const answer of answers) {
    await page.getByLabel('你的回答').fill(answer)
    await page.getByRole('button', { name: '保存并继续' }).click()
  }

  const downloadPromise = page.waitForEvent('download')
  await page.getByRole('button', { name: '下载我的进度包' }).click()
  const download = await downloadPromise
  const path = await download.path()
  expect(path).not.toBeNull()
  const text = await readFile(path as string, 'utf8')
  const checkpoint = JSON.parse(text)
  expect(checkpoint.answers.map((item: { text: string }) => item.text)).toEqual(answers)
  expect(text).not.toMatch(/api[_-]?key|authorization|bearer/i)
})
```

- [ ] **Step 3: Run the mobile golden path**

Run: `pnpm test:e2e`

Expected: both Playwright tests PASS on the Pixel 7 project.

- [ ] **Step 4: Commit acceptance tests**

```bash
git add apps/web/e2e
git commit -m "test: prove breakpoint resume and safe export"
```

## Task 7: Document and verify the vertical slice

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Add the Web/PWA development section to README**

Append:

```markdown
## Life Design Studio Web（阶段 0）

仓库正在增加一个移动端优先、可中断恢复的 Web 体验。当前纵切片只验证最重要的数据承诺：回答先保存在本机，然后流程才前进。

```bash
pnpm install
pnpm dev
```

打开 <http://localhost:3000>，回答三个问题。关闭页面后重新打开，系统会回到准确断点；完成后可下载不含 API Key 的 JSON 进度包。

验证命令：

```bash
pnpm test
pnpm typecheck
pnpm test:e2e
pnpm --filter @life-design/web build
```

阶段 0 不调用模型、不收费、也不上传云端。完整四阶段、BYOK 与托管体验将在断点恢复纵切片通过验收后逐步加入。
```

- [ ] **Step 2: Run the full verification suite**

Run: `pnpm test && pnpm typecheck && pnpm test:e2e && pnpm --filter @life-design/web build`

Expected: all unit tests and both E2E tests PASS, all packages type-check, and the production build exits 0.

- [ ] **Step 3: Inspect repository status and generated files**

Run: `git status --short`

Expected: only `README.md` is modified; `.next`, test results and downloaded checkpoints remain ignored or outside Git tracking.

- [ ] **Step 4: Commit the verified vertical-slice documentation**

```bash
git add README.md
git commit -m "docs: explain resumable web slice"
```

- [ ] **Step 5: Record acceptance evidence**

Capture one mobile screenshot before answering and one after reopening at question two. Add the paths and the four successful verification commands to the pull request description; do not add screenshots containing real personal answers to the public repository.

## Stage 0 definition of done

- A fresh user can start without an account, API Key, payment, or cloud service.
- Each answer is durably persisted before the question cursor advances.
- Closing and reopening the page restores the exact next question and prior answer.
- Three completed answers export as a versioned JSON checkpoint with no credential-shaped fields.
- The Pixel 7 Playwright golden path, unit tests, type checking, and production build all pass.
- The original Agent/CLI files and MIT attribution continue to work unchanged.
