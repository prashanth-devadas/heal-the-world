import { describe, it, expect, vi, afterEach } from "vitest";
import { fetchOracleEvents, fetchCampaigns } from "./api";

afterEach(() => {
  vi.unstubAllGlobals();
});

function mockFetch(body: unknown, ok = true, status = 200) {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({
      ok,
      status,
      json: async () => body,
    })
  );
}

describe("fetchOracleEvents", () => {
  it("returns data array on success", async () => {
    const items = [{ id: "1", event_type: "earthquake" }];
    mockFetch({ data: items });
    const result = await fetchOracleEvents();
    expect(result).toEqual(items);
  });

  it("throws on non-ok response", async () => {
    mockFetch({ message: "error" }, false, 500);
    await expect(fetchOracleEvents()).rejects.toThrow("API error 500");
  });

  it("returns empty array when data key is absent", async () => {
    mockFetch({});
    const result = await fetchOracleEvents();
    expect(result).toEqual([]);
  });
});

describe("fetchCampaigns", () => {
  it("passes status param as query param", async () => {
    mockFetch({ data: [] });
    await fetchCampaigns({ status: "active" });
    const calledUrl: string = (vi.mocked(fetch).mock.calls[0][0] as string).toString();
    expect(calledUrl).toContain("status=active");
  });

  it("passes type param as query param", async () => {
    mockFetch({ data: [] });
    await fetchCampaigns({ type: "conflict" });
    const calledUrl: string = (vi.mocked(fetch).mock.calls[0][0] as string).toString();
    expect(calledUrl).toContain("type=conflict");
  });

  it("throws on non-ok response", async () => {
    mockFetch({}, false, 404);
    await expect(fetchCampaigns()).rejects.toThrow("API error 404");
  });

  it("returns data array on success", async () => {
    const campaigns = [{ id: "abc" }];
    mockFetch({ data: campaigns });
    const result = await fetchCampaigns();
    expect(result).toEqual(campaigns);
  });
});
