"use server";

import type { StringLiteralUnion } from "shikiji";
import { getHighlighter } from "shikiji";

export async function highlight(
  code: string,
  lang: StringLiteralUnion<string>,
) {
  const highlighter = await getHighlighter({
    themes: ["one-dark-pro"],
    langs: [lang],
  });
  return highlighter.codeToHtml(code.trim(), {
    lang: lang,
    theme: "one-dark-pro",
  });
}
