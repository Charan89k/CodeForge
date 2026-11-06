import { describe, expect, it } from "vitest";

import { contentDocumentSchema } from "@/lib/validation/content";

import { markdownToBlocks, MarkdownError, parseInline } from "./markdown";

describe("parseInline", () => {
  it("splits marks and keeps the text between them", () => {
    expect(parseInline("a `b` **c** *d* [e](/f) g")).toEqual([
      { type: "text", value: "a " },
      { type: "code", value: "b" },
      { type: "text", value: " " },
      { type: "strong", value: "c" },
      { type: "text", value: " " },
      { type: "em", value: "d" },
      { type: "text", value: " " },
      { type: "link", value: "e", href: "/f" },
      { type: "text", value: " g" },
    ]);
  });

  it("does not make a link from a javascript: URL", () => {
    expect(
      parseInline("[x](javascript:alert(1))").every((n) => n.type !== "link")
    ).toBe(true);
  });

  it("does not make a link to another host from a //host path", () => {
    expect(parseInline("[x](//evil.test/a)").every((n) => n.type !== "link")).toBe(
      true
    );
  });

  it.each(["javascript:alert(1)", "data:text/html,x", "//evil.test"])(
    "refuses a %s link in stored blocks",
    (href) => {
      const block = {
        type: "paragraph",
        content: [{ type: "link", value: "x", href }],
      };
      expect(contentDocumentSchema.safeParse([block]).success).toBe(false);
    }
  );

  it("leaves raw HTML as text for React to escape", () => {
    expect(parseInline("<script>alert(1)</script>")).toEqual([
      { type: "text", value: "<script>alert(1)</script>" },
    ]);
  });
});

describe("markdownToBlocks", () => {
  const source = [
    "## Why it matters",
    "",
    "A short paragraph",
    "on two lines.",
    "",
    "- one",
    "- two",
    "",
    "1. first",
    "2. second",
    "",
    "```python",
    "print(1)",
    "",
    "print(2)",
    "```",
    "",
    "> [!tip] Remember",
    "> Keep it short.",
    "",
    "| a | b |",
    "|---|---|",
    "| 1 | 2 |",
    "",
    ":::visualization binary-search",
    ":::problems running-altitude shelf-rebalance",
    ":::quiz some-quiz",
    "",
    "### Details",
  ].join("\n");

  it("produces every block type, valid against the content schema", () => {
    const blocks = markdownToBlocks(source);
    expect(blocks.map((b) => b.type)).toEqual([
      "heading",
      "paragraph",
      "list",
      "list",
      "code",
      "callout",
      "table",
      "visualization",
      "problems",
      "quiz",
      "heading",
    ]);
    expect(contentDocumentSchema.safeParse(blocks).success).toBe(true);
  });

  it("keeps code verbatim, including blank lines", () => {
    const code = markdownToBlocks(source).find((b) => b.type === "code");
    expect(code).toMatchObject({ language: "python", code: "print(1)\n\nprint(2)" });
  });

  it("joins a paragraph's lines", () => {
    expect(markdownToBlocks("one\ntwo")).toEqual([
      { type: "paragraph", content: [{ type: "text", value: "one two" }] },
    ]);
  });

  it("reads a callout's tone and title", () => {
    expect(markdownToBlocks("> [!warning] Careful\n> Body")[0]).toMatchObject({
      type: "callout",
      tone: "warning",
      title: "Careful",
    });
    expect(markdownToBlocks("> Plain")[0]).toMatchObject({
      type: "callout",
      tone: "note",
    });
  });

  it("closes a fence only on one at least as long, with nothing after it", () => {
    expect(markdownToBlocks("````md\n```python\nx\n```\n````\nafter")).toMatchObject([
      { type: "code", language: "md", code: "```python\nx\n```" },
      { type: "paragraph" },
    ]);
    expect(markdownToBlocks("```\n```python\n```")).toMatchObject([
      { type: "code", code: "```python" },
    ]);
  });

  it.each([
    ["## ", /no text/],
    ["### ", /no text/],
    ["text\n\n##  ", /Line 3: This heading has no text/],
    ["# Title", /page owns the title/],
    ["```python\nnever closed", /never closed/],
    [":::nonsense x", /Unknown directive/],
    ["> [!shout] Hi\n> there", /Callouts are one of/],
    ["| a |\n| 1 |", /header row/],
  ])("explains what is wrong with %j, naming the line", (bad, message) => {
    expect(() => markdownToBlocks(bad)).toThrow(MarkdownError);
    expect(() => markdownToBlocks(bad)).toThrow(message);
  });
});
