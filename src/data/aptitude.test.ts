import { describe, expect, it } from "vitest";

import { APTITUDE_TOPICS, aptitudeTopic, gradeAptitude } from "./aptitude";

describe("aptitude content", () => {
  it("has a valid answer and an explanation for every question", () => {
    const ids = new Set<string>();
    for (const topic of APTITUDE_TOPICS) {
      for (const q of topic.questions) {
        expect(ids.has(q.id), `${q.id} is duplicated`).toBe(false);
        ids.add(q.id);
        expect(q.answer).toBeGreaterThanOrEqual(0);
        expect(q.answer).toBeLessThan(q.options.length);
        expect(new Set(q.options).size).toBe(q.options.length);
        expect(q.explanation.length).toBeGreaterThan(5);
      }
    }
  });

  it("computes the worked quantitative answers independently", () => {
    const answerOf = (id: string) => {
      const q = APTITUDE_TOPICS[0]!.questions.find((x) => x.id === id)!;
      return q.options[q.answer];
    };
    expect(answerOf("q1")).toBe(`${(150 / 10) * 3.6} km/h`);
    expect(answerOf("q3")).toBe(`${(3 * 12) / 4} days`);
    expect(answerOf("q4")).toBe(String(6 * 20 - 5 * 18));
    expect(answerOf("q6")).toBe(String((64 / 8) * 5));
    expect(answerOf("q8")).toBe(`${(10 / 50) * 100}%`);
  });

  it("computes the new topics' answers independently", () => {
    const answerOf = (topic: string, id: string) => {
      const q = aptitudeTopic(topic)!.questions.find((x) => x.id === id)!;
      return q.options[q.answer];
    };
    const di = (id: string) => answerOf("data-interpretation", id);
    expect(di("di1")).toBe(String((40 + 50 + 60) / 3));
    expect(di("di2")).toBe(`${((250 - 200) / 200) * 100}%`);
    expect(di("di3")).toBe(String((35 / 100) * 80));
    expect(di("di4")).toBe(`${(30 / (12 + 18 + 30)) * 100}%`);
    expect(di("di5")).toBe(`${((75 - 60) / 60) * 100}%`);
    expect(di("di6")).toBe(String((40 * 2) / 5));
    expect(di("di7")).toBe(String(Math.round(100 * 1.1 * 1.1)));
    expect(di("di8")).toBe(String(80 * 3 - 70 - 80));

    const pr = (id: string) => answerOf("programming", id);
    expect(pr("pr1")).toBe(String(5 * 2 + 1));
    expect(pr("pr2")).toBe(String(17 % 5));
    expect(pr("pr3")).toBe(String((10 * 11) / 2));
    let passes = 0;
    for (let i = 1; i < 64; i *= 2) passes += 1;
    expect(pr("pr4")).toBe(String(passes));
    expect(pr("pr5")).toBe(String(0b1011));
    expect(pr("pr7")).toBe(String((true && false) || !false));
    expect(pr("pr8")).toBe(String(Math.log2(1024)));
  });
});

describe("gradeAptitude", () => {
  const topic = APTITUDE_TOPICS[1]!;

  it("counts only correct answers, treating blanks as wrong", () => {
    const first = topic.questions[0]!;
    const result = gradeAptitude(topic.questions, { [first.id]: first.answer });
    expect(result).toMatchObject({ correct: 1, total: topic.questions.length });
    expect(result.review[1]?.chosen).toBeNull();
  });

  it("ignores ids that are not in the set", () => {
    expect(gradeAptitude(topic.questions, { nope: 1 }).correct).toBe(0);
  });
});
