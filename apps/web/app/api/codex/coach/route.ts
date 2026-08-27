import { createCodexCliProvider } from '@life-design/providers'
import { coachRequestSchema } from '@life-design/providers/contracts'
import { localCodexErrorResponse, readLocalCodexRequest } from '../route-utils'

export const runtime = 'nodejs'

export async function POST(request: Request) {
  try {
    const input = coachRequestSchema.parse(await readLocalCodexRequest(request))
    const result = await createCodexCliProvider().coach(input)
    return Response.json(result)
  } catch (cause) {
    return localCodexErrorResponse(cause)
  }
}
