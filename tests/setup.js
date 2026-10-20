import { afterEach, beforeEach, vi } from "vitest";
import { resetStorageCacheForTests } from "../src/lib/storage.js";

beforeEach(() => {
  localStorage.clear();
  resetStorageCacheForTests();
  vi.stubGlobal(
    "matchMedia",
    vi.fn().mockImplementation((query) => ({
      matches: false,
      media: query,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  );
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});
