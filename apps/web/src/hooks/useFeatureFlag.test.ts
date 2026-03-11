import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { describe, it, expect, vi, afterEach } from "vitest";
import { createElement } from "react";
import { useFeatureFlag } from "./useFeatureFlag";

function makeWrapper() {
  const client = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  });
  return ({ children }: { children: React.ReactNode }) =>
    createElement(QueryClientProvider, { client }, children);
}

function mockFetch(data: unknown, ok = true) {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({
      ok,
      json: async () => data,
    })
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("useFeatureFlag", () => {
  it("returns false when feature is not in list", async () => {
    mockFetch({ data: [{ key: "other-flag", enabled: true }] });
    const { result } = renderHook(() => useFeatureFlag("my-flag"), {
      wrapper: makeWrapper(),
    });
    await waitFor(() => {
      expect(result.current).toBe(false);
    });
  });

  it("returns true when feature is in list with enabled:true", async () => {
    mockFetch({ data: [{ key: "my-flag", enabled: true }] });
    const { result } = renderHook(() => useFeatureFlag("my-flag"), {
      wrapper: makeWrapper(),
    });
    await waitFor(() => {
      expect(result.current).toBe(true);
    });
  });

  it("returns false when feature is in list with enabled:false", async () => {
    mockFetch({ data: [{ key: "my-flag", enabled: false }] });
    const { result } = renderHook(() => useFeatureFlag("my-flag"), {
      wrapper: makeWrapper(),
    });
    await waitFor(() => {
      expect(result.current).toBe(false);
    });
  });

  it("returns false when fetch returns non-ok (empty array fallback)", async () => {
    mockFetch({}, false);
    const { result } = renderHook(() => useFeatureFlag("my-flag"), {
      wrapper: makeWrapper(),
    });
    await waitFor(() => {
      expect(result.current).toBe(false);
    });
  });
});
