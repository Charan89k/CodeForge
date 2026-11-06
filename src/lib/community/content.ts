import { parseInline } from "@/lib/cms/markdown";
import type { InlineNode } from "@/types/content";

/**
 * What a community post may contain, and how it is turned into something
 * React renders. Deliberately small: paragraphs, fenced code, and the inline
 * marks lessons use. No HTML, no headings, no embeds, so nothing a learner
 * writes can run or impersonate the page around it.
 */

export const TITLE_MIN = 8;
export const TITLE_MAX = 160;
export const BODY_MAX = 10_000;
export const REPLY_MAX = 5_000;
/** More than this many links in one post reads as spam. */
export const LINKS_MAX = 5;
/** More than this many mentions in one post is a notification blast. */
export const MENTIONS_MAX = 5;

export type CommunityBlock =
  | { type: "paragraph"; content: InlineNode[] }
  | { type: "code"; language: string; code: string };

const SAFE_HREF = /^(https?:\/\/|\/(?!\/))/;
const FENCE = /^```([a-z0-9+#-]{0,20})\s*$/i;

/** Paragraphs and fenced code. A link with an unsafe address stays plain text. */
export function toBlocks(body: string): CommunityBlock[] {
  const blocks: CommunityBlock[] = [];
  const lines = body.replace(/\r\n?/g, "\n").split("\n");
  let paragraph: string[] = [];
  const flush = () => {
    const text = paragraph.join(" ").trim();
    if (text) blocks.push({ type: "paragraph", content: safeInline(text) });
    paragraph = [];
  };

  for (let i = 0; i < lines.length; i += 1) {
    const fence = FENCE.exec(lines[i]!);
    if (!fence) {
      if (lines[i]!.trim() === "") flush();
      else paragraph.push(lines[i]!);
      continue;
    }
    flush();
    const code: string[] = [];
    for (i += 1; i < lines.length && !FENCE.test(lines[i]!.trim()); i += 1) {
      code.push(lines[i]!);
    }
    blocks.push({ type: "code", language: fence[1] || "text", code: code.join("\n") });
  }
  flush();
  return blocks;
}

function safeInline(text: string): InlineNode[] {
  return parseInline(text).map((node) =>
    node.type === "link" && !SAFE_HREF.test(node.href)
      ? { type: "text", value: `[${node.value}](${node.href})` }
      : node
  );
}

/** Links a post would render, for the spam rule. */
export function countLinks(body: string): number {
  const inline = toBlocks(body).flatMap((b) =>
    b.type === "paragraph" ? b.content : []
  );
  const bare = body.match(/https?:\/\/\S+/g)?.length ?? 0;
  return Math.max(inline.filter((n) => n.type === "link").length, bare);
}

// Usernames are 3 to 30 lowercase letters, digits, hyphens or underscores (Settings).
const MENTION = /(^|[^\w@-])@([a-z0-9_-]{3,30})(?![\w-])/gi;

/** Distinct usernames mentioned, lower-cased, outside code blocks. */
export function mentionsIn(body: string): string[] {
  const prose = toBlocks(body)
    .flatMap((b) => (b.type === "paragraph" ? b.content : []))
    .filter((n) => n.type === "text" || n.type === "strong" || n.type === "em")
    .map((n) => n.value)
    .join(" ");
  return [...new Set([...prose.matchAll(MENTION)].map((m) => m[2]!.toLowerCase()))];
}
