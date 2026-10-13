import { ALLOWED_MODELS, DEFAULT_MODEL } from "@/lib/server/claude";
import type { ServerStatus } from "@/lib/types";

export const dynamic = "force-dynamic";

export function GET() {
  const status: ServerStatus = {
    serverKey: !!process.env.ANTHROPIC_API_KEY,
    accessCodeRequired: !!process.env.APP_ACCESS_CODE,
    defaultModel: DEFAULT_MODEL,
    models: [...ALLOWED_MODELS],
  };
  return Response.json(status);
}
