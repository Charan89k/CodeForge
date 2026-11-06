import { describe, expect, it } from "vitest";

import { countLinks, mentionsIn, toBlocks } from "./content";

describe("toBlocks", () => {
  it("splits paragraphs on blank lines and keeps fenced code verbatim", () => {
    expect(toBlocks("One\nline\n\n```python\nx = 1\n\nprint(x)\n```\n\nAfter")).toEqual(
      [
        { type: "paragraph", content: [{ type: "text", value: "One line" }] },
        { type: "code", language: "python", code: "x = 1\n\nprint(x)" },
        { type: "paragraph", content: [{ type: "text", value: "After" }] },
      ]
    );
  });

  it("leaves HTML as text for React to escape", () => {
    expect(toBlocks("<img src=x onerror=alert(1)>")).toEqual([
      {
        type: "paragraph",
        content: [{ type: "text", value: "<img src=x onerror=alert(1)>" }],
      },
    ]);
  });

  it.each(["javascript:alert(1)", "data:text/html,x", "//evil.test/a"])(
    "never makes a link to %s",
    (href) => {
      const nodes = toBlocks(`See [this](${href}) now`).flatMap((b) =>
        b.type === "paragraph" ? b.content : []
      );
      expect(nodes.some((n) => n.type === "link")).toBe(false);
    }
  );

  it("keeps web links and site paths as links", () => {
    const nodes = toBlocks("[a](https://example.test) and [b](/learn)").flatMap((b) =>
      b.type === "paragraph" ? b.content : []
    );
    expect(nodes.flatMap((n) => (n.type === "link" ? [n.href] : []))).toEqual([
      "https://example.test",
      "/learn",
    ]);
  });

  it("treats an unclosed fence as code to the end", () => {
    expect(toBlocks("```\nopen")).toEqual([
      { type: "code", language: "text", code: "open" },
    ]);
  });
});

describe("countLinks", () => {
  it("counts marked and bare links, whichever is more", () => {
    expect(countLinks("[a](https://a.test) https://b.test https://c.test")).toBe(3);
    expect(countLinks("no links")).toBe(0);
  });
});

describe("mentionsIn", () => {
  it("finds distinct usernames, not emails or code", () => {
    expect(
      mentionsIn("Thanks @Asha_K and @asha_k, cc me@mail.test\n\n```\n@ghost\n```")
    ).toEqual(["asha_k"]);
    expect(mentionsIn("ask @dev-ravi.")).toEqual(["dev-ravi"]);
  });
});
