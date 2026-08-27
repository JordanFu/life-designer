import { spawn } from 'node:child_process'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
  blueprintDraftSchema,
  blueprintOutputJsonSchema,
  blueprintRequestSchema,
  coachOutputJsonSchema,
  coachRequestSchema,
  type BlueprintDraft,
  type BlueprintRequest,
  type CoachRequest,
  type CoachTurnDraft,
} from './contracts'
import { coachTurnDraftSchema } from '@life-design/core'
import { buildBlueprintPrompt, buildCoachPrompt } from './prompts'

const schemaToken = '__LIFE_DESIGN_OUTPUT_SCHEMA__'
const outputToken = '__LIFE_DESIGN_OUTPUT_MESSAGE__'
const maxCapturedBytes = 256_000

export type CodexExecution = {
  args: string[]
  stdin: string
  outputSchema: object
}

export type CodexExecutor = (execution: CodexExecution) => Promise<string>

export class CodexProviderError extends Error {
  constructor(
    message: string,
    public readonly code: 'unavailable' | 'timeout' | 'invalid-output',
  ) {
    super(message)
    this.name = 'CodexProviderError'
  }
}

const baseArgs = [
  'exec',
  '--ephemeral',
  '--ignore-user-config',
  '--ignore-rules',
  '--sandbox',
  'read-only',
  '--skip-git-repo-check',
  '--color',
  'never',
  '--output-schema',
  schemaToken,
  '--output-last-message',
  outputToken,
  '-',
]

function appendBounded(current: string, chunk: Buffer): string {
  if (Buffer.byteLength(current) >= maxCapturedBytes) return current
  return (current + chunk.toString('utf8')).slice(0, maxCapturedBytes)
}

export const executeCodex: CodexExecutor = async ({ args, stdin, outputSchema }) => {
  const directory = await mkdtemp(join(tmpdir(), 'life-design-codex-'))
  const schemaPath = join(directory, 'schema.json')
  const outputPath = join(directory, 'result.json')
  await writeFile(schemaPath, JSON.stringify(outputSchema), { mode: 0o600 })
  const resolvedArgs = args.map((value) =>
    value === schemaToken ? schemaPath : value === outputToken ? outputPath : value,
  )

  try {
    await new Promise<void>((resolve, reject) => {
      const child = spawn('codex', resolvedArgs, {
        cwd: directory,
        shell: false,
        stdio: ['pipe', 'pipe', 'pipe'],
      })
      let stdout = ''
      let stderr = ''
      let timedOut = false
      const timeout = setTimeout(() => {
        timedOut = true
        child.kill('SIGTERM')
      }, 120_000)

      child.stdout.on('data', (chunk: Buffer) => {
        stdout = appendBounded(stdout, chunk)
      })
      child.stderr.on('data', (chunk: Buffer) => {
        stderr = appendBounded(stderr, chunk)
      })
      child.on('error', () => {
        clearTimeout(timeout)
        reject(new CodexProviderError('本机 Codex 暂时不可用', 'unavailable'))
      })
      child.on('close', (code) => {
        clearTimeout(timeout)
        if (timedOut) {
          reject(new CodexProviderError('Codex 回应超时，请稍后重试', 'timeout'))
        } else if (code !== 0) {
          void stdout
          void stderr
          reject(new CodexProviderError('本机 Codex 未就绪或当前登录已失效', 'unavailable'))
        } else {
          resolve()
        }
      })
      child.stdin.end(stdin)
    })
    return await readFile(outputPath, 'utf8')
  } finally {
    await rm(directory, { recursive: true, force: true })
  }
}

function parseModelJson(raw: string): unknown {
  try {
    return JSON.parse(raw)
  } catch {
    throw new CodexProviderError('Codex 返回了无法读取的内容', 'invalid-output')
  }
}

export function createCodexCliProvider(options: { executor?: CodexExecutor } = {}) {
  const executor = options.executor ?? executeCodex

  async function coach(raw: CoachRequest): Promise<CoachTurnDraft> {
    const input = coachRequestSchema.parse(raw)
    const output = await executor({
      args: [...baseArgs],
      stdin: buildCoachPrompt(input),
      outputSchema: coachOutputJsonSchema,
    })
    const parsed = coachTurnDraftSchema.safeParse(parseModelJson(output))
    if (!parsed.success) {
      throw new CodexProviderError('Codex 回应缺少必要内容', 'invalid-output')
    }
    return parsed.data
  }

  async function blueprint(raw: BlueprintRequest): Promise<BlueprintDraft> {
    const input = blueprintRequestSchema.parse(raw)
    const output = await executor({
      args: [...baseArgs],
      stdin: buildBlueprintPrompt(input),
      outputSchema: blueprintOutputJsonSchema,
    })
    const parsed = blueprintDraftSchema.safeParse(parseModelJson(output))
    if (!parsed.success) {
      throw new CodexProviderError('Codex 蓝图缺少必要内容', 'invalid-output')
    }
    return parsed.data
  }

  return { coach, blueprint }
}
