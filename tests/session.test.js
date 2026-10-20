import { describe, expect, it } from "vitest";
import {
  createSessionState,
  getSessionDurationMinutes,
  pauseSessionClock,
  resumeSessionClock,
} from "../src/domain/session.js";

describe("session timing", () => {
  it("counts active time and excludes an overnight pause", () => {
    const start = Date.parse("2026-10-19T08:00:00Z");
    let session = createSessionState({
      id: "session-1",
      templateId: "A",
      weekKey: "2026-10-19",
      slots: [],
      now: start,
    });

    session = pauseSessionClock(session, start + 10 * 60_000);
    session = resumeSessionClock(session, start + 24 * 60 * 60_000);

    expect(
      getSessionDurationMinutes(session, start + 24 * 60 * 60_000 + 5 * 60_000),
    ).toBe(15);
  });

  it("normalizes old sessions that only have startTime", () => {
    const start = Date.parse("2026-10-19T08:00:00Z");
    expect(
      getSessionDurationMinutes(
        {
          id: "legacy",
          startTime: new Date(start).toISOString(),
          status: "in_progress",
        },
        start + 7 * 60_000,
      ),
    ).toBe(7);
  });
});
