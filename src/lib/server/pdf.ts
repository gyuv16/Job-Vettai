import "server-only";

import { extractText, getDocumentProxy } from "unpdf";
import { HttpError } from "./claude";

/**
 * Text from a base64 PDF, for engines that can't read PDFs themselves (the free
 * Mistral and Groq engines). Scanned PDFs have no text layer, so ask for pasted text.
 */
export async function pdfToText(base64: string): Promise<string> {
  let pages: string[];
  try {
    const pdf = await getDocumentProxy(new Uint8Array(Buffer.from(base64, "base64")));
    try {
      pages = (await extractText(pdf, { mergePages: false })).text;
    } finally {
      await pdf.cleanup().catch(() => {});
    }
  } catch {
    throw new HttpError(422, "That PDF couldn't be read. Paste the CV as text instead.", "PDF_BAD");
  }
  const text = pages
    .map((p) => p.replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim())
    .filter(Boolean)
    .join("\n\n");
  if (text.replace(/\s/g, "").length < 40) {
    throw new HttpError(422, "This PDF has no selectable text (it may be a scan or an image). Paste the CV as text instead.", "PDF_NO_TEXT");
  }
  return text;
}
