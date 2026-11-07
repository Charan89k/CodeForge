import { z } from "zod";

import { diagramSchema } from "@/lib/diagram/schema";
import type { ContentBlock, ContentDocument } from "@/types/content";

/**
 * Runtime validation for content documents.
 *
 * Chapter and problem bodies are `Json` columns, which means Prisma gives no
 * guarantees about their shape. Everything that writes content - the seed
 * script and the admin editor - validates through here first, so the renderer
 * can trust its input and does not need a defensive branch per block type.
 */

const inlineNodeSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("text"), value: z.string() }),
  z.object({ type: z.literal("code"), value: z.string() }),
  z.object({ type: z.literal("strong"), value: z.string() }),
  z.object({ type: z.literal("em"), value: z.string() }),
  z.object({
    type: z.literal("link"),
    value: z.string(),
    href: z.string(),
  }),
]);

const inlineContentSchema = z.array(inlineNodeSchema);

const complexityRowSchema = z.object({
  operation: z.string().min(1),
  time: z.string().min(1),
  space: z.string().min(1),
  note: z.string().optional(),
});

export const contentBlockSchema: z.ZodType<ContentBlock> = z.discriminatedUnion(
  "type",
  [
    z.object({
      type: z.literal("heading"),
      level: z.union([z.literal(2), z.literal(3)]),
      text: z.string().min(1),
      id: z.string().optional(),
    }),
    z.object({
      type: z.literal("paragraph"),
      content: inlineContentSchema,
    }),
    z.object({
      type: z.literal("list"),
      ordered: z.boolean(),
      items: z.array(inlineContentSchema),
    }),
    z.object({
      type: z.literal("code"),
      language: z.string().min(1),
      code: z.string(),
      caption: z.string().optional(),
      highlightLines: z.array(z.number().int().positive()).optional(),
    }),
    z.object({
      type: z.literal("architecture"),
      caption: z.string().optional(),
      // Delegated to the diagram schema, which is also what validates a
      // learner's own design — one definition of "a valid diagram".
      diagram: diagramSchema,
    }),
    z.object({
      type: z.literal("callout"),
      tone: z.enum(["note", "tip", "warning", "insight"]),
      title: z.string().optional(),
      content: inlineContentSchema,
    }),
    z.object({
      type: z.literal("table"),
      caption: z.string().optional(),
      headers: z.array(z.string()),
      rows: z.array(z.array(z.string())),
    }),
    z.object({
      type: z.literal("complexity"),
      caption: z.string().optional(),
      rows: z.array(complexityRowSchema).min(1),
    }),
    z.object({
      type: z.literal("concept"),
      title: z.string().min(1),
      body: inlineContentSchema,
    }),
    z.object({
      type: z.literal("example"),
      title: z.string().optional(),
      input: z.string().min(1),
      steps: z
        // A step can speak for itself: an empty note is authored, not malformed.
        .array(z.object({ state: z.string().min(1), note: z.string() }))
        .min(1),
      output: z.string().min(1),
    }),
    z.object({
      type: z.literal("visualization"),
      visualizationKey: z.string().min(1),
      title: z.string().optional(),
      input: z.unknown().optional(),
    }),
    z.object({
      type: z.literal("beforeAfter"),
      title: z.string().optional(),
      // Bounded so a malformed block cannot render a row wide enough to
      // break the page. Both sides are free to differ in length: a filter
      // legitimately produces fewer values than it consumed.
      before: z.object({
        label: z.string().min(1).max(60),
        values: z.array(z.string().max(24)).min(1).max(24),
      }),
      after: z.object({
        label: z.string().min(1).max(60),
        values: z.array(z.string().max(24)).min(1).max(24),
      }),
      note: z.string().max(400).optional(),
    }),
    z.object({
      type: z.literal("comparison"),
      title: z.string().optional(),
      options: z
        .array(
          z.object({
            label: z.string().min(1).max(80),
            time: z.string().min(1).max(40),
            space: z.string().min(1).max(40),
            when: z.string().min(1).max(400),
            preferred: z.boolean().optional(),
          })
        )
        .min(2)
        .max(4),
    }),
    z.object({
      type: z.literal("quiz"),
      quizSlug: z.string().min(1),
    }),
    z.object({
      type: z.literal("problems"),
      slugs: z.array(z.string().min(1)),
      title: z.string().optional(),
    }),
    z.object({
      type: z.literal("recognition"),
      prompt: z.string().min(1),
      clues: z.array(z.string().min(1)).min(1),
      answerPatternSlug: z.string().min(1),
      explanation: z.string().min(1),
    }),
    z.object({ type: z.literal("divider") }),
  ]
) as unknown as z.ZodType<ContentBlock>;

export const contentDocumentSchema = z.array(contentBlockSchema);

/**
 * Parses a `Json` column into a document.
 *
 * Returns an empty document rather than throwing when a row is malformed: a
 * single bad record should degrade that one chapter, not take down the page.
 * The failure is logged so it is visible rather than silent.
 */
export function parseContent(value: unknown, context?: string): ContentDocument {
  const result = contentDocumentSchema.safeParse(value);
  if (result.success) return result.data;

  console.error(
    `Malformed content document${context ? ` (${context})` : ""}:`,
    result.error.issues.slice(0, 3)
  );
  return [];
}

/** Strict parse for writes. Throws, because a bad write must not be saved. */
export function assertContent(value: unknown): ContentDocument {
  return contentDocumentSchema.parse(value);
}
