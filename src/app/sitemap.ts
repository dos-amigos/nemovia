import type { MetadataRoute } from "next";
import { createClient } from "@/lib/supabase/server";

export const revalidate = 3600;

const BASE_URL =
  process.env.NEXT_PUBLIC_SITE_URL ?? "https://nemovia.vercel.app";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const staticEntries: MetadataRoute.Sitemap = [
    {
      url: BASE_URL,
      lastModified: new Date(),
      changeFrequency: "daily",
      priority: 1,
    },
    {
      url: `${BASE_URL}/cerca`,
      lastModified: new Date(),
      changeFrequency: "daily",
      priority: 0.9,
    },
    {
      url: `${BASE_URL}/mappa`,
      lastModified: new Date(),
      changeFrequency: "daily",
      priority: 0.9,
    },
  ];

  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("sagre")
      .select("slug, updated_at")
      .eq("is_active", true);

    if (error) {
      console.error("sitemap query error:", error.message);
      return staticEntries;
    }

    const sagraEntries: MetadataRoute.Sitemap = (data ?? []).map((sagra) => ({
      url: `${BASE_URL}/sagra/${sagra.slug}`,
      lastModified: sagra.updated_at ? new Date(sagra.updated_at) : new Date(),
      changeFrequency: "daily" as const,
      priority: 0.8,
    }));

    return [...staticEntries, ...sagraEntries];
  } catch (err) {
    console.error("sitemap unexpected error:", err);
    return staticEntries;
  }
}
