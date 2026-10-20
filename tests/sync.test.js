import { describe, expect, it } from "vitest";
import { enqueueSyncPayload } from "../src/app/sync.js";
import { storageGet } from "../src/lib/storage.js";

describe("sync outbox", () => {
  it("deduplicates retries by stable session id", () => {
    const payload = { session_id: "session-1", exercises: [] };
    expect(enqueueSyncPayload(payload)).toBe(true);
    expect(enqueueSyncPayload(payload)).toBe(true);
    expect(storageGet("grind:sync-queue", [])).toHaveLength(1);
  });
});
