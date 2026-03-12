const PEXELS_API_KEY = process.env.PEXELS_API_KEY;

interface PexelsVideoFile {
  quality: string;
  file_type: string;
  width: number;
  height: number;
  link: string;
}

interface PexelsVideo {
  video_files: PexelsVideoFile[];
}

interface PexelsSearchResponse {
  videos: PexelsVideo[];
}

/**
 * Search Pexels for an ambient city video.
 * Fallback chain: "{city} Italy" → "{province} Italy" → "Veneto Italy countryside"
 * Returns a direct video URL (mp4) or null.
 */
export async function searchCityVideo(
  locationText: string,
  province?: string | null
): Promise<string | null> {
  if (!PEXELS_API_KEY) return null;

  const cityName = extractCityName(locationText);

  const queries = [
    `${cityName} Italy`,
    province ? `${province} Italy` : null,
    "Veneto Italy countryside",
  ].filter(Boolean) as string[];

  for (const query of queries) {
    const url = `https://api.pexels.com/videos/search?query=${encodeURIComponent(query)}&per_page=1&size=small&orientation=landscape`;

    try {
      const res = await fetch(url, {
        headers: { Authorization: PEXELS_API_KEY },
        next: { revalidate: 86400 }, // Cache 24h
      });

      if (!res.ok) continue;

      const data: PexelsSearchResponse = await res.json();
      if (data.videos.length === 0) continue;

      const video = data.videos[0];
      // Prefer HD mp4 ≤ 1280px wide, fallback to SD
      const hdFile = video.video_files.find(
        (f) =>
          f.quality === "hd" &&
          f.file_type === "video/mp4" &&
          f.width <= 1280
      );
      const sdFile = video.video_files.find(
        (f) => f.quality === "sd" && f.file_type === "video/mp4"
      );

      const file = hdFile ?? sdFile;
      if (file?.link) return file.link;
    } catch {
      continue;
    }
  }

  return null;
}

/**
 * Extract city name from location_text.
 * "Zugliano (VI)" → "Zugliano"
 * "San Bonifacio" → "San Bonifacio"
 */
export function extractCityName(locationText: string): string {
  return locationText.replace(/\s*\([^)]+\)\s*$/, "").trim();
}
