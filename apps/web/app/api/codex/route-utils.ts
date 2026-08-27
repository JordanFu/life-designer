import { CodexProviderError } from '@life-design/providers'

const maxRequestBytes = 256_000

export async function readLocalCodexRequest(request: Request): Promise<unknown> {
  if (process.env.LIFE_DESIGN_LOCAL_CODEX !== '1') {
    throw new LocalCodexRouteError('本地 Codex 未启用', 503)
  }
  const declaredLength = Number(request.headers.get('content-length') ?? 0)
  if (declaredLength > maxRequestBytes) {
    throw new LocalCodexRouteError('本次人生设计素材过大，无法发送给本地模型', 413)
  }
  const text = await request.text()
  if (Buffer.byteLength(text, 'utf8') > maxRequestBytes) {
    throw new LocalCodexRouteError('本次人生设计素材过大，无法发送给本地模型', 413)
  }
  try {
    return JSON.parse(text)
  } catch {
    throw new LocalCodexRouteError('请求内容无法读取', 400)
  }
}

export class LocalCodexRouteError extends Error {
  constructor(message: string, public readonly status: number) {
    super(message)
  }
}

export function localCodexErrorResponse(cause: unknown): Response {
  if (cause instanceof LocalCodexRouteError) {
    return Response.json({ error: cause.message }, { status: cause.status })
  }
  if (cause instanceof CodexProviderError) {
    const status = cause.code === 'timeout' ? 504 : 503
    return Response.json({ error: cause.message }, { status })
  }
  return Response.json({ error: '本地 Codex 暂时不可用，请稍后重试' }, { status: 503 })
}
