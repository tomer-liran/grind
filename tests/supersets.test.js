import { describe, expect, it } from "vitest";
import { getNextSupersetTarget } from "../src/domain/supersets.js";

function doneSets(count) {
  return Array.from({ length: count }, () => ({ done: true }));
}

describe("superset progression", () => {
  it("continues the partner that still has sets remaining", () => {
    const session = {
      slotIndex: 1,
      slots: [{ supersetGroup: "arms" }, { supersetGroup: "arms" }],
      pickedExercises: [{ sets: 4 }, { sets: 3 }],
      currentSets: doneSets(3),
      partialSets: {
        0: [...doneSets(3), { done: false }],
        1: doneSets(3),
      },
    };

    expect(getNextSupersetTarget(session)).toEqual({
      type: "jump",
      slotIndex: 0,
      needsRest: true,
    });
  });

  it("completes only when every partner is done", () => {
    const session = {
      slotIndex: 1,
      slots: [{ supersetGroup: "arms" }, { supersetGroup: "arms" }],
      pickedExercises: [{ sets: 4 }, { sets: 3 }],
      currentSets: doneSets(3),
      partialSets: {
        0: doneSets(4),
        1: doneSets(3),
      },
    };

    expect(getNextSupersetTarget(session)).toEqual({
      type: "complete-all",
      slotIndices: [0, 1],
    });
  });
});
