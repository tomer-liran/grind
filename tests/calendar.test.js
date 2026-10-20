import { execFileSync } from "node:child_process";
import { describe, expect, it } from "vitest";
import { formatLocalDateKey, getLocalWeekKey } from "../src/domain/calendar.js";

describe("local calendar keys", () => {
  it("returns the local Monday without converting it to UTC", () => {
    const mondayAtNoon = new Date(2026, 9, 19, 12);
    expect(getLocalWeekKey(mondayAtNoon)).toBe("2026-10-19");
    expect(formatLocalDateKey(mondayAtNoon)).toBe("2026-10-19");
  });

  it.each([
    ["Pacific/Kiritimati", "2026-10-19T00:30:00", "2026-10-19"],
    ["Europe/Berlin", "2026-10-19T00:30:00", "2026-10-19"],
    ["UTC", "2026-10-18T23:30:00", "2026-10-12"],
    ["America/Los_Angeles", "2026-10-19T00:30:00", "2026-10-19"],
  ])("is correct in %s", (timezone, timestamp, expected) => {
    const script = [
      'import { getLocalWeekKey } from "./src/domain/calendar.js";',
      `process.stdout.write(getLocalWeekKey(new Date("${timestamp}")));`,
    ].join("");
    const result = execFileSync(
      process.execPath,
      ["--input-type=module", "--eval", script],
      {
        cwd: process.cwd(),
        env: { ...process.env, TZ: timezone },
        encoding: "utf8",
      },
    );
    expect(result).toBe(expected);
  });
});
