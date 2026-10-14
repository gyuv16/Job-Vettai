import { handle } from "@/lib/server/claude";
import { pingAll } from "@/lib/server/llm";

export const maxDuration = 60;

/** Settings → "Test AI connection": one tiny real request to each engine, with the same key resolution as every AI route. */
export const POST = handle(async (req) => pingAll(req));
