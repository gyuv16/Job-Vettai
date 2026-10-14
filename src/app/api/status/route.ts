import { ALLOWED_MODELS, DEFAULT_MODEL, ENV_MODEL_STATE, envVar, WORKSPACE_ID } from "@/lib/server/claude";
import type { ServerStatus } from "@/lib/types";

export const dynamic = "force-dynamic";

/** Public, secret-free summary of how this deployment is configured. Never returns key values. */
export function GET() {
  const ws = envVar("ANTHROPIC_WORKSPACE_ID");
  const status: ServerStatus = {
    serverKey: !!envVar("ANTHROPIC_API_KEY"),
    serverWorkspace: ws ? (WORKSPACE_ID.test(ws) ? "set" : "invalid") : "unset",
    accessCodeRequired: !!envVar("APP_ACCESS_CODE"),
    defaultModel: DEFAULT_MODEL,
    modelSetting: ENV_MODEL_STATE,
    models: [...ALLOWED_MODELS],
    workspaceSupport: true,
    commit: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? null,
    branch: process.env.VERCEL_GIT_COMMIT_REF ?? null,
    environment: process.env.VERCEL_ENV ?? null,
  };
  return Response.json(status);
}
