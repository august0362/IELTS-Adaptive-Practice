import { vi } from "vitest";

interface MockResponse {
  status?: number;
  json: unknown;
}

/**
 * Stubs global fetch to return the given responses in order, one per call.
 * The last response repeats if fetch is called more times than provided.
 * Ignores request URL/method matching — tests using this know the exact
 * call order their component makes.
 */
export function mockFetchSequence(responses: MockResponse[]) {
  let callIndex = 0;
  const calls: { url: string; init?: RequestInit }[] = [];

  const fetchMock = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
    const url = typeof input === "string" ? input : input.toString();
    calls.push({ url, init });
    const response = responses[Math.min(callIndex, responses.length - 1)];
    callIndex++;
    return {
      ok: (response.status ?? 200) < 400,
      status: response.status ?? 200,
      json: async () => response.json,
    } as Response;
  });

  vi.stubGlobal("fetch", fetchMock);
  return { fetchMock, calls };
}
