import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock the Supabase server client before importing the module under test
vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(),
}));

import sitemap from "./sitemap";
import { createClient } from "@/lib/supabase/server";

const mockCreateClient = vi.mocked(createClient);

describe("sitemap", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns at least 3 static entries (/, /cerca, /mappa)", async () => {
    // Mock Supabase to return empty data
    mockCreateClient.mockResolvedValue({
      from: () => ({
        select: () => ({
          eq: () => ({
            data: [],
            error: null,
          }),
        }),
      }),
    } as unknown as Awaited<ReturnType<typeof createClient>>);

    const result = await sitemap();

    expect(result.length).toBeGreaterThanOrEqual(3);

    const urls = result.map((entry) => entry.url);
    expect(urls.some((u) => u.endsWith("/") || !u.includes("/", 8))).toBe(
      true
    ); // root
    expect(urls.some((u) => u.includes("/cerca"))).toBe(true);
    expect(urls.some((u) => u.includes("/mappa"))).toBe(true);
  });

  it("includes dynamic sagra URLs from Supabase", async () => {
    mockCreateClient.mockResolvedValue({
      from: () => ({
        select: () => ({
          eq: () => ({
            data: [
              {
                slug: "sagra-del-pesce",
                updated_at: "2026-03-01T00:00:00Z",
              },
            ],
            error: null,
          }),
        }),
      }),
    } as unknown as Awaited<ReturnType<typeof createClient>>);

    const result = await sitemap();

    const urls = result.map((entry) => entry.url);
    expect(urls.some((u) => u.includes("/sagra/sagra-del-pesce"))).toBe(true);
  });

  it("returns only static entries when Supabase query fails", async () => {
    mockCreateClient.mockResolvedValue({
      from: () => ({
        select: () => ({
          eq: () => ({
            data: null,
            error: { message: "connection error" },
          }),
        }),
      }),
    } as unknown as Awaited<ReturnType<typeof createClient>>);

    const result = await sitemap();

    expect(result.length).toBe(3);
  });
});
