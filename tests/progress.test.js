import { describe, expect, it } from "vitest";
import {
  buildPRStateFromHistory,
  calculateExerciseMetrics,
  formatKilograms,
  formatWeightLabel,
  getExerciseRecordKey,
  parseWeight,
  previewPersonalBests,
} from "../src/domain/progress.js";

describe("progress calculations", () => {
  it("treats bodyweight values as unweighted", () => {
    expect(parseWeight("BW")).toBeNull();
    expect(parseWeight("—")).toBeNull();
    expect(parseWeight(undefined)).toBeNull();
    expect(parseWeight("not-a-weight")).toBeNull();
    expect(parseWeight("12,5")).toBe(12.5);
    expect(formatWeightLabel("12.5")).toBe("12.5kg");
    expect(formatWeightLabel(null)).toBe("BW");
    expect(formatKilograms(12)).toBe("12");
    expect(formatKilograms(12.25)).toBe("12.3");
    expect(previewPersonalBests({}, [{ weight: "BW", reps: "10" }])).toEqual({});
  });

  it("calculates volume and only reports records that improve", () => {
    expect(calculateExerciseMetrics()).toBeNull();
    expect(
      calculateExerciseMetrics([
        { weight: "10", reps: "10" },
        { weight: "BW", reps: "8" },
        { weight: "12.5", reps: "invalid" },
      ]),
    ).toEqual({ maxSetWeight: 12.5, sessionVolume: 100 });

    expect(
      previewPersonalBests({ maxWeight: 20, maxVolume: 200 }, [
        { weight: "10", reps: "10" },
      ]),
    ).toEqual({});
    expect(getExerciseRecordKey({ exerciseId: "stable-id" })).toBe("stable-id");
    expect(getExerciseRecordKey({ id: "exercise-id" })).toBe("exercise-id");
    expect(getExerciseRecordKey({ exerciseName: "Named exercise" })).toBe(
      "Named exercise",
    );
    expect(getExerciseRecordKey({ name: "Fallback name" })).toBe("Fallback name");
    expect(getExerciseRecordKey(null)).toBe("");
  });

  it("builds stable-id PR projections from completed history", () => {
    const result = buildPRStateFromHistory([
      {
        date: "20/10/2026",
        weekKey: "2026-10-19",
        entries: [
          {
            exerciseId: "goblet-squat",
            exerciseName: "Goblet Squat",
            sets: [
              { weight: "30", reps: "10" },
              { weight: "32.5", reps: "8" },
            ],
          },
        ],
      },
    ]);

    expect(result["goblet-squat"]).toMatchObject({
      maxWeight: 32.5,
      maxVolume: 560,
      lastWeight: "32.5",
    });
  });

  it("preserves nudge metadata and skips unusable history entries", () => {
    const result = buildPRStateFromHistory(
      [
        { entries: [{ exerciseName: "Bodyweight", sets: [{ weight: "BW" }] }] },
        { entries: [{ sets: [{ weight: "10", reps: "2" }] }] },
        {
          date: "20/10/2026",
          entries: [
            {
              exerciseId: "row",
              exerciseName: "Dumbbell Row",
              sets: [{ weight: "20", reps: "8" }],
            },
          ],
        },
      ],
      {
        "Dumbbell Row": {
          exerciseId: "legacy-row",
          lastNudgeDate: "2026-10-01",
        },
      },
    );

    expect(Object.keys(result)).toEqual(["row"]);
    expect(result.row.lastNudgeDate).toBe("2026-10-01");
    expect(result.row.sessions[0].weekKey).toBeNull();
  });
});
