import { z } from "zod";
import { handle, readJson } from "@/lib/server/claude";
import { fetchPosting } from "@/lib/server/posting";

export const maxDuration = 60;

const Body = z.object({ url: z.string().url().max(2000) });

export const POST = handle(async (req) => {
  const { url } = await readJson(req, Body);
  return fetchPosting(url);
});
