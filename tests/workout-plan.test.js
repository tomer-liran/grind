import { describe, expect, it } from "vitest";
import { DAYS, EXERCISES } from "../src/data/workouts.js";
import {
  pickExerciseFromPool,
  validateWorkoutConfig,
} from "../src/domain/workout-plan.js";

describe("workout configuration", () => {
  it("validates the checked-in workout data", () => {
    expect(validateWorkoutConfig(DAYS, EXERCISES)).toEqual([]);
  });

  it("reports missing pools instead of silently finishing a workout", () => {
    expect(
      validateWorkoutConfig(
        { A: { slots: [{ id: "missing", key: "missing", label: "Missing" }] } },
        {},
      ),
    ).toContain('Slot "Missing" in template "A" references empty category "missing".');
  });

  it("reports malformed and duplicate exercises and templates", () => {
    const errors = validateWorkoutConfig(
      {
        empty: { slots: [] },
        broken: {
          slots: [
            { key: "bad" },
            { id: "missing-category", key: "missing", label: "Missing category" },
          ],
        },
      },
      {
        empty: [],
        bad: [
          { id: "duplicate", name: "", sets: 0, restSeconds: -1 },
          { id: "duplicate", name: "Duplicate", sets: 1.5, restSeconds: "30" },
          { name: "Missing id", sets: 1, restSeconds: 0 },
        ],
      },
    );

    expect(errors).toEqual(
      expect.arrayContaining([
        'Category "empty" must contain at least one exercise.',
        'Exercise 1 in "bad" is missing a name.',
        'Exercise 1 in "bad" must define a positive integer set count.',
        'Exercise 1 in "bad" must define a non-negative rest duration.',
        'Exercise id "duplicate" is duplicated.',
        'Exercise 3 in "bad" is missing a stable id.',
        'Template "empty" must contain at least one slot.',
        'Slot 1 in template "broken" is missing an id.',
        'Slot "Missing category" in template "broken" references empty category "missing".',
      ]),
    );
  });

  it("avoids weekly and in-session repeats before falling back", () => {
    const pool = [
      { id: "a", name: "A" },
      { id: "b", name: "B" },
      { id: "c", name: "C" },
    ];
    expect(
      pickExerciseFromPool({
        pool,
        weekUsedIds: ["a"],
        sessionUsedIds: ["b"],
        random: () => 0,
      }),
    ).toEqual(pool[2]);
  });

  it("falls back through exclusion levels and handles empty pools", () => {
    const pool = [
      { id: "a", name: "A" },
      { id: "b", name: "B" },
    ];

    expect(pickExerciseFromPool({ pool: [] })).toBeNull();
    expect(
      pickExerciseFromPool({
        pool,
        weekUsedIds: ["a", "b"],
        sessionUsedIds: ["a"],
        excludedIds: ["b"],
        random: () => 0.99,
      }),
    ).toEqual(pool[1]);
  });
});
