import { handle, ping } from "@/lib/server/claude";

export const maxDuration = 60;

/** Settings → "Test AI connection": one tiny real request with the same key resolution as every AI route. */
export const POST = handle(async (req) => ping(req));
