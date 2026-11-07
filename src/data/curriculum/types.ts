import type { Difficulty } from "@/generated/prisma/enums";
import type { Diagram, NodeKind } from "@/lib/diagram/types";
import type { ContentBlock, InlineNode } from "@/types/content";

/**
 * Authoring format for the curriculum.
 *
 * A Chapter IS the lesson — the route tree stops at `[chapter]`, so there is
 * no level below it. Chapters carry their content as typed blocks, which is
 * what lets a lesson embed a stepped visualization, an inline quiz or a
 * practice list without any of it being a string of HTML.
 *
 * Every chapter here follows the same teaching sequence:
 *
 *   what it is → why it matters → mental model → example → visual →
 *   code → complexity → common mistakes → pattern recognition →
 *   quiz → practice
 *
 * Not every chapter needs every step, but the order never changes, because
 * the point of a curriculum is that the reader learns where to look.
 */

export type ChapterSeed = {
  slug: string;
  title: string;
  summary: string;
  difficulty: Difficulty;
  readingMinutes: number;
  /** What the reader should be able to do afterwards. Shown before the body. */
  objectives: string[];
  /** Restated at the end, as the recap. */
  keyTakeaways: string[];
  content: ContentBlock[];
  /** Pattern slugs this chapter teaches. */
  patterns?: string[];
  /** Problem slugs to practise afterwards. */
  problems?: string[];
  /** Quiz slug, if the chapter has one. */
  quiz?: string;
};

export type SectionSeed = {
  slug: string;
  title: string;
  summary: string;
  chapters: ChapterSeed[];
};

export type CourseSeed = {
  slug: string;
  title: string;
  subtitle: string;
  description: string;
  icon: string;
  /** The subject the library files it under. */
  category: string;
  estimatedHours: number;
  sections: SectionSeed[];
};

// ---------------------------------------------------------------------------
// Authoring helpers. These keep the content files readable; without them the
// block literals drown the prose they exist to carry.
// ---------------------------------------------------------------------------

export function h2(text: string): ContentBlock {
  return { type: "heading", level: 2, text };
}

export function h3(text: string): ContentBlock {
  return { type: "heading", level: 3, text };
}

export function p(text: string): ContentBlock {
  return { type: "paragraph", content: [{ type: "text", value: text }] };
}

/** Paragraph with inline marks: strings are plain, objects carry a mark. */
export function rp(
  ...nodes: (string | { code: string } | { strong: string } | { em: string })[]
): ContentBlock {
  return {
    type: "paragraph",
    content: nodes.map((node): InlineNode =>
      typeof node === "string"
        ? { type: "text", value: node }
        : "code" in node
          ? { type: "code", value: node.code }
          : "strong" in node
            ? { type: "strong", value: node.strong }
            : { type: "em", value: node.em }
    ),
  };
}

export function ul(...items: string[]): ContentBlock {
  return {
    type: "list",
    ordered: false,
    items: items.map((item) => [{ type: "text", value: item }]),
  };
}

export function ol(...items: string[]): ContentBlock {
  return {
    type: "list",
    ordered: true,
    items: items.map((item) => [{ type: "text", value: item }]),
  };
}

export function code(
  language: string,
  source: string,
  caption?: string,
  highlightLines?: number[]
): ContentBlock {
  return { type: "code", language, code: source, caption, highlightLines };
}

export function note(text: string, title?: string): ContentBlock {
  return {
    type: "callout",
    tone: "note",
    title,
    content: [{ type: "text", value: text }],
  };
}

export function tip(text: string, title?: string): ContentBlock {
  return {
    type: "callout",
    tone: "tip",
    title,
    content: [{ type: "text", value: text }],
  };
}

export function warn(text: string, title?: string): ContentBlock {
  return {
    type: "callout",
    tone: "warning",
    title,
    content: [{ type: "text", value: text }],
  };
}

export function insight(text: string, title?: string): ContentBlock {
  return {
    type: "callout",
    tone: "insight",
    title,
    content: [{ type: "text", value: text }],
  };
}

export function concept(title: string, body: string): ContentBlock {
  return { type: "concept", title, body: [{ type: "text", value: body }] };
}

export function complexity(
  rows: { operation: string; time: string; space: string; note?: string }[],
  caption?: string
): ContentBlock {
  return { type: "complexity", rows, caption };
}

export function table(
  headers: string[],
  rows: string[][],
  caption?: string
): ContentBlock {
  return { type: "table", headers, rows, caption };
}

export function worked(
  input: string,
  output: string,
  steps: { state: string; note: string }[],
  title?: string
): ContentBlock {
  return { type: "example", title, input, output, steps };
}

export function visual(
  visualizationKey: string,
  title?: string,
  input?: unknown
): ContentBlock {
  return { type: "visualization", visualizationKey, title, input };
}

/**
 * An architecture diagram, authored as nodes and edges.
 *
 * Stored as data rather than an image so the same picture is themeable,
 * readable by a screen reader, and comparable against what a learner draws
 * in the system-design workspace.
 */
export function arch(diagram: Diagram, caption?: string): ContentBlock {
  return { type: "architecture", diagram, caption };
}

/** Shorthand for a linear request path, which is most lesson diagrams. */
export function flow(
  steps: { id: string; kind: NodeKind; label: string; note?: string }[],
  caption?: string
): ContentBlock {
  return arch(
    {
      nodes: steps.map(({ id, kind, label, note }) => ({ id, kind, label, note })),
      edges: steps.slice(1).map((step, i) => ({
        id: `e${i}`,
        from: steps[i]!.id,
        to: step.id,
        kind: "sync" as const,
      })),
    },
    caption
  );
}

export function quizBlock(quizSlug: string): ContentBlock {
  return { type: "quiz", quizSlug };
}

export function practice(slugs: string[], title?: string): ContentBlock {
  return { type: "problems", slugs, title };
}

/**
 * Visual intuition: the same data before and after.
 *
 * Values are authored as strings so a row can hold `"…"` or `"-"` where a
 * literal value would be noise. Reach for this when the endpoints are the
 * lesson, and for `visual()` when the steps between them are.
 */
export function beforeAfter(
  before: { label: string; values: (string | number)[] },
  after: { label: string; values: (string | number)[] },
  options: { title?: string; note?: string } = {}
): ContentBlock {
  return {
    type: "beforeAfter",
    title: options.title,
    note: options.note,
    before: { label: before.label, values: before.values.map(String) },
    after: { label: after.label, values: after.values.map(String) },
  };
}

/** Competing approaches, compared on cost and on when each one is right. */
export function compare(
  options: {
    label: string;
    time: string;
    space: string;
    when: string;
    preferred?: boolean;
  }[],
  title?: string
): ContentBlock {
  return { type: "comparison", title, options };
}

export function recognise(
  prompt: string,
  clues: string[],
  answerPatternSlug: string,
  explanation: string
): ContentBlock {
  return { type: "recognition", prompt, clues, answerPatternSlug, explanation };
}

export const divider: ContentBlock = { type: "divider" };
