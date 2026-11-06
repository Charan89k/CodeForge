import type { CalloutTone, ContentBlock, InlineNode } from "@/types/content";

/**
 * Turns the Markdown authors write into the typed blocks lessons render.
 *
 * A deliberately small dialect, not a general Markdown engine: headings, lists,
 * code fences, tables, callouts and three directives. Raw HTML has no path to
 * the page because everything becomes a typed block that React escapes.
 *
 *   ## Heading                 > [!tip] Optional title
 *   - item or 1. item          > Callout body
 *   ```python                  :::visualization binary-search
 *   | a | b |                  :::problems two-sum other-slug
 *                              :::quiz quiz-slug
 */
const INLINE =
  /(`[^`]+`)|(\*\*[^*]+\*\*)|(\*[^*]+\*)|(\[[^\]]+\]\((?:https?:\/\/|\/(?!\/))[^)\s]*\))/g;

export function parseInline(text: string): InlineNode[] {
  const nodes: InlineNode[] = [];
  let last = 0;
  for (const match of text.matchAll(INLINE)) {
    const at = match.index;
    if (at > last) nodes.push({ type: "text", value: text.slice(last, at) });
    const token = match[0];
    if (token.startsWith("`")) nodes.push({ type: "code", value: token.slice(1, -1) });
    else if (token.startsWith("**"))
      nodes.push({ type: "strong", value: token.slice(2, -2) });
    else if (token.startsWith("*"))
      nodes.push({ type: "em", value: token.slice(1, -1) });
    else {
      const split = token.indexOf("](");
      nodes.push({
        type: "link",
        value: token.slice(1, split),
        href: token.slice(split + 2, -1),
      });
    }
    last = at + token.length;
  }
  if (last < text.length) nodes.push({ type: "text", value: text.slice(last) });
  return nodes;
}

const TONES: readonly CalloutTone[] = ["note", "tip", "warning", "insight"];
const cells = (row: string) =>
  row
    .trim()
    .replace(/^\||\|$/g, "")
    .split("|")
    .map((c) => c.trim());

export class MarkdownError extends Error {
  constructor(
    readonly line: number,
    message: string
  ) {
    super(`Line ${line}: ${message}`);
    this.name = "MarkdownError";
  }
}

export function markdownToBlocks(source: string): ContentBlock[] {
  const lines = source.replace(/\r\n/g, "\n").split("\n");
  const blocks: ContentBlock[] = [];
  let i = 0;

  const startsBlock = (line: string) => /^(#{2,3} |```|> |- |\d+\. |\||:::)/.test(line);

  while (i < lines.length) {
    const line = lines[i]!;
    if (!line.trim()) {
      i += 1;
      continue;
    }

    if (/^#{1,6}\s+$/.test(line)) {
      throw new MarkdownError(i + 1, "This heading has no text.");
    }

    const heading = /^(#{1,6}) (.+)$/.exec(line);
    if (heading) {
      if (heading[1]!.length !== 2 && heading[1]!.length !== 3) {
        throw new MarkdownError(
          i + 1,
          "Use ## or ### for headings; the page owns the title."
        );
      }
      blocks.push({
        type: "heading",
        level: heading[1]!.length as 2 | 3,
        text: heading[2]!.trim(),
      });
      i += 1;
      continue;
    }

    const fence = /^(`{3,})(.*)$/.exec(line);
    if (fence) {
      const language = fence[2]!.trim() || "text";
      const closer = new RegExp(`^\`{${fence[1]!.length},}\\s*$`);
      const start = i + 1;
      let end = start;
      while (end < lines.length && !closer.test(lines[end]!)) end += 1;
      if (end === lines.length)
        throw new MarkdownError(i + 1, "This code fence is never closed.");
      blocks.push({ type: "code", language, code: lines.slice(start, end).join("\n") });
      i = end + 1;
      continue;
    }

    if (line.startsWith(":::")) {
      const [name, ...args] = line.slice(3).trim().split(/\s+/);
      if (name === "visualization" && args[0]) {
        blocks.push({ type: "visualization", visualizationKey: args[0] });
      } else if (name === "problems" && args.length > 0) {
        blocks.push({ type: "problems", slugs: args });
      } else if (name === "quiz" && args[0]) {
        blocks.push({ type: "quiz", quizSlug: args[0] });
      } else {
        throw new MarkdownError(i + 1, `Unknown directive ":::${name ?? ""}".`);
      }
      i += 1;
      continue;
    }

    if (line.startsWith("> ")) {
      const body: string[] = [];
      while (i < lines.length && lines[i]!.startsWith("> ")) {
        body.push(lines[i]!.slice(2));
        i += 1;
      }
      const marker = /^\[!(\w+)\]\s*(.*)$/.exec(body[0]!);
      const tone = marker ? (marker[1]!.toLowerCase() as CalloutTone) : "note";
      if (!TONES.includes(tone)) {
        throw new MarkdownError(i, `Callouts are one of: ${TONES.join(", ")}.`);
      }
      const text = (marker ? body.slice(1) : body).join(" ").trim();
      const title = marker?.[2]?.trim();
      blocks.push({
        type: "callout",
        tone,
        ...(title ? { title } : {}),
        content: parseInline(text),
      });
      continue;
    }

    const ordered = /^\d+\. /.test(line);
    if (ordered || line.startsWith("- ")) {
      const pattern = ordered ? /^\d+\. / : /^- /;
      const items: InlineNode[][] = [];
      while (i < lines.length && pattern.test(lines[i]!)) {
        items.push(parseInline(lines[i]!.replace(pattern, "")));
        i += 1;
      }
      blocks.push({ type: "list", ordered, items });
      continue;
    }

    if (line.startsWith("|")) {
      const rows: string[] = [];
      while (i < lines.length && lines[i]!.startsWith("|")) {
        rows.push(lines[i]!);
        i += 1;
      }
      if (rows.length < 2 || !/^[\s|:-]+$/.test(rows[1]!)) {
        throw new MarkdownError(i, "A table needs a header row and a |---| row.");
      }
      blocks.push({
        type: "table",
        headers: cells(rows[0]!),
        rows: rows.slice(2).map(cells),
      });
      continue;
    }

    const paragraph: string[] = [];
    while (i < lines.length && lines[i]!.trim() && !startsBlock(lines[i]!)) {
      paragraph.push(lines[i]!.trim());
      i += 1;
    }
    blocks.push({ type: "paragraph", content: parseInline(paragraph.join(" ")) });
  }
  return blocks;
}
