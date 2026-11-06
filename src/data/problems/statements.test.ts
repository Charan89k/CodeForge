import { describe, expect, it } from "vitest";

import { contentDocumentSchema } from "@/lib/validation/content";
import { PROBLEMS } from "./index";

/**
 * A statement that fails the schema renders as a blank page, because
 * parseContent degrades to an empty document on read. So every one is checked.
 */
describe("problem statements", () => {
  it.each(PROBLEMS.map((p) => [p.slug, p.statement] as const))(
    "%s is a valid document",
    (_slug, statement) => {
      expect(contentDocumentSchema.safeParse(statement).error?.issues).toBeUndefined();
    }
  );
});
