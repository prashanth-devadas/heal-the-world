import { describe, it, expect, vi } from "vitest";
import { build } from "../test-helpers";

// Fully chainable thenable mock — mirrors Supabase query builder
function makeChain(resolveValue = { data: [], error: null }) {
  const chain: any = {
    then(resolve: any, reject: any) {
      return Promise.resolve(resolveValue).then(resolve, reject);
    },
    catch(reject: any) { return Promise.resolve(resolveValue).catch(reject); },
  };
  // Every method returns the same chainable object
  for (const m of ["select","eq","order","single","neq","gt","lt","in","is","limit"]) {
    chain[m] = vi.fn().mockReturnValue(chain);
  }
  // Override single to return null data (triggers 404)
  chain.single = vi.fn().mockReturnValue({
    then(resolve: any, reject: any) {
      return Promise.resolve({ data: null, error: { message: "not found" } }).then(resolve, reject);
    },
    catch(reject: any) { return Promise.reject().catch(reject); },
  });
  return chain;
}

vi.mock("../db/client", () => ({
  db: {
    from: vi.fn(() => makeChain()),
  },
}));

describe("GET /api/v1/campaigns", () => {
  it("returns 200 with data array", async () => {
    const app = await build();
    const res = await app.inject({ method: "GET", url: "/api/v1/campaigns" });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(Array.isArray(body.data)).toBe(true);
  });

  it("accepts status filter", async () => {
    const app = await build();
    const res = await app.inject({ method: "GET", url: "/api/v1/campaigns?status=active" });
    expect(res.statusCode).toBe(200);
  });
});

describe("GET /api/v1/campaigns/:id", () => {
  it("returns 404 for unknown id", async () => {
    const app = await build();
    const res = await app.inject({
      method: "GET",
      url: "/api/v1/campaigns/00000000-0000-0000-0000-000000000000",
    });
    expect(res.statusCode).toBe(404);
  });
});

describe("GET /health", () => {
  it("returns ok", async () => {
    const app = await build();
    const res = await app.inject({ method: "GET", url: "/health" });
    expect(res.statusCode).toBe(200);
  });
});
