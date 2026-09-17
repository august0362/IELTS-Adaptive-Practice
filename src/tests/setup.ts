import "@testing-library/jest-dom/vitest";
import { afterEach, vi } from "vitest";
import { cleanup } from "@testing-library/react";

// Not using Vitest's `globals: true`, so RTL's auto-cleanup (which hooks the
// global `afterEach`) never registers on its own — do it explicitly instead.
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});
