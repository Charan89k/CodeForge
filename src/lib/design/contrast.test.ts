import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

/**
 * The Learn palette's text pairs, measured from the stylesheet itself so a
 * token change that breaks contrast fails here rather than in a reader's eyes.
 */
const css = readFileSync(join(process.cwd(), "src/app/globals.css"), "utf8");

function tokens(selector: string): Record<string, string> {
  const at = css.indexOf(`${selector} {`);
  expect(at, selector).toBeGreaterThan(-1);
  const body = css.slice(at, css.indexOf("}", at));
  return Object.fromEntries(
    [...body.matchAll(/--([\w-]+):\s*(#[0-9a-f]{6});/g)].map((m) => [m[1]!, m[2]!])
  );
}

function luminance(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const c = Number.parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!;
}

function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi! + 0.05) / (lo! + 0.05);
}

const TEXT = [
  "foreground",
  "muted-foreground",
  "subtle-foreground",
  "brand-300",
  "brand-400",
  "info",
  "success",
  "warning",
  "destructive",
  "difficulty-easy",
  "difficulty-medium",
  "difficulty-hard",
];
const SURFACES = ["background", "card", "popover", "secondary", "muted", "accent"];

describe.each([
  ["dark", '[data-surface="learn"]'],
  ["light", '.light[data-surface="learn"]'],
])("Learn palette, %s", (_name, selector) => {
  const palette = tokens(selector);

  it.each(TEXT.flatMap((t) => SURFACES.map((s) => [t, s] as const)))(
    "%s on %s is at least 4.5:1",
    (text, surface) => {
      expect(contrast(palette[text]!, palette[surface]!)).toBeGreaterThanOrEqual(4.5);
    }
  );

  it("keeps white on the primary button at least 4.5:1", () => {
    expect(
      contrast(palette["primary-foreground"]!, palette.primary!)
    ).toBeGreaterThanOrEqual(4.5);
  });

  it("keeps input borders and focus rings at least 3:1 against the page", () => {
    expect(contrast(palette.input!, palette.background!)).toBeGreaterThanOrEqual(3);
    expect(contrast(palette.ring!, palette.background!)).toBeGreaterThanOrEqual(3);
  });
});
