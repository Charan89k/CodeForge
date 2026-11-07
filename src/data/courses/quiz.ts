import type { QuizQuestionSource } from "./index";

/**
 * A question from its right answer and its distractors. The options are
 * rotated by a hash of the prompt, so the right one is not always first and
 * its place stays the same between runs.
 */
export function choice(
  prompt: string,
  right: string,
  wrong: string[],
  explanation: string,
  code?: string
): QuizQuestionSource {
  const hash = [...prompt].reduce((sum, ch) => (sum * 31 + ch.charCodeAt(0)) >>> 0, 7);
  const count = wrong.length + 1;
  const at = hash % count;
  const texts = [...wrong.slice(0, at), right, ...wrong.slice(at)];
  const options = texts.map((text, index) => ({ id: "abcdef"[index]!, text }));
  return {
    type: code ? "CODE_OUTPUT" : "MULTIPLE_CHOICE",
    prompt,
    ...(code ? { code } : {}),
    options,
    answer: options[at]!.id,
    explanation,
  };
}
