import "server-only";

import { z } from "zod";
import type { CoverLetter, CvDoc, Evaluation, Profile, Review } from "../types";

const obj = <T,>() => z.custom<T>((v) => typeof v === "object" && v !== null && !Array.isArray(v), "expected an object");

export const profileInput = obj<Profile>();
export const evaluationInput = obj<Evaluation>();
export const cvInput = obj<CvDoc>();
export const coverInput = obj<CoverLetter>();
export const reviewInput = obj<Review>();

export const postingInput = z.object({
  text: z.string().min(80, "The posting text is too short to evaluate.").max(60000),
  url: z.string().max(2000).optional(),
  company: z.string().max(200).optional(),
  role: z.string().max(200).optional(),
  location: z.string().max(200).optional(),
});
