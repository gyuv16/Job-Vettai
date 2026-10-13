import "server-only";

function numericEntity(cp: number): string {
  return cp >= 0 && cp <= 0x10ffff ? String.fromCodePoint(cp) : "";
}

const NAMED: Record<string, string> = {
  ndash: "–",
  mdash: "—",
  lsquo: "‘",
  rsquo: "’",
  ldquo: "“",
  rdquo: "”",
  hellip: "…",
  bull: "•",
  middot: "·",
  rupee: "₹",
  euro: "€",
  pound: "£",
  copy: "©",
  reg: "®",
  trade: "™",
};

export function decodeEntities(text: string): string {
  return text
    .replace(/&([a-z]+);/g, (m, name: string) => NAMED[name] ?? m)
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, d) => numericEntity(parseInt(d, 10)))
    .replace(/&#[xX]([0-9a-fA-F]+);/g, (_, h) => numericEntity(parseInt(h, 16)))
    .replace(/&nbsp;/g, " ");
}

/**
 * HTML to readable text. Drops script/style/noscript/svg and HTML comments
 * (a common place to hide prompt-injection text), keeps block breaks as newlines.
 */
export function htmlToText(html: string): string {
  const withBreaks = html
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<(script|style|noscript|svg|template|iframe)[\s\S]*?<\/\1>/gi, " ")
    .replace(/<\s*br\s*\/?>/gi, "\n")
    .replace(/<\/(p|li|ul|ol|div|h\d|tr|section|article)>/gi, "\n")
    .replace(/<li[^>]*>/gi, "• ");
  return decodeEntities(withBreaks.replace(/<[^>]+>/g, " "))
    .replace(/[ \t]+/g, " ")
    .replace(/ *\n */g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
