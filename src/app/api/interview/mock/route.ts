import { z } from "zod";
import { chat, handle, readJson } from "@/lib/server/claude";
import { profileInput } from "@/lib/server/inputs";
import { postingBlock, profileBrief, system } from "@/lib/server/prompts";

export const maxDuration = 120;

const Body = z.object({
  profile: profileInput,
  company: z.string(),
  role: z.string(),
  stage: z.string(),
  postingText: z.string().max(30000).default(""),
  messages: z
    .array(z.object({ role: z.enum(["user", "assistant"]), content: z.string().max(6000) }))
    .max(40),
});

const TASK = `Run a realistic mock interview. You play the interviewer for the given company, role and stage. Ask one question at a time. After each candidate answer, give two lines of coaching in a "Feedback:" line (what worked, one concrete improvement, referencing STAR structure where relevant), then ask the next question on a new line starting with "Next question:". Keep the whole reply under 120 words. Mix behavioral, role-specific and motivation questions, and probe known gaps politely. When the candidate says they are done, give a short overall debrief with three strengths and three things to practise.`;

export const POST = handle(async (req) => {
  const b = await readJson(req, Body);
  const context = `${profileBrief(b.profile)}\n\nCompany: ${b.company}\nRole: ${b.role}\nStage: ${b.stage}\n${postingBlock(b.postingText || "(posting not saved)")}`;
  const messages = b.messages.length ? b.messages : [{ role: "user" as const, content: "I'm ready. Please start the interview." }];
  const reply = await chat({
    req,
    system: `${system(TASK)}\n\n${context}`,
    messages: messages[0].role === "user" ? messages : [{ role: "user", content: "Start the interview." }, ...messages],
    effort: "low",
  });
  return { reply };
});
