import { ImageResponse } from "next/og";
import { getSagraBySlug } from "@/lib/queries/sagre";

export const alt = "Sagra del Veneto";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function OGImage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const sagra = await getSagraBySlug(slug);

  const title = sagra?.title ?? "Sagra del Veneto";
  const location = sagra
    ? [sagra.location_text, sagra.province].filter(Boolean).join(", ")
    : "";

  let dateText = "";
  if (sagra?.start_date) {
    try {
      const start = new Date(sagra.start_date);
      const formatter = new Intl.DateTimeFormat("it-IT", {
        day: "numeric",
        month: "long",
        year: "numeric",
      });
      dateText = formatter.format(start);
      if (sagra.end_date && sagra.end_date !== sagra.start_date) {
        const end = new Date(sagra.end_date);
        dateText += ` - ${formatter.format(end)}`;
      }
    } catch {
      // skip date if formatting fails
    }
  }

  return new ImageResponse(
    (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          width: "100%",
          height: "100%",
          padding: "60px",
          background: "linear-gradient(135deg, #fdf0ee, #edf9f7)",
        }}
      >
        <div
          style={{
            display: "flex",
            flexDirection: "column",
          }}
        >
          <div
            style={{
              display: "flex",
              fontSize: 64,
              fontWeight: 700,
              color: "#1c1917",
              lineHeight: 1.2,
              maxWidth: "100%",
              overflow: "hidden",
            }}
          >
            {title}
          </div>
          {location && (
            <div
              style={{
                display: "flex",
                fontSize: 32,
                color: "#57534e",
                marginTop: "16px",
              }}
            >
              {location}
            </div>
          )}
          {dateText && (
            <div
              style={{
                display: "flex",
                fontSize: 28,
                color: "#57534e",
                marginTop: "12px",
              }}
            >
              {dateText}
            </div>
          )}
        </div>
        <div
          style={{
            display: "flex",
            fontSize: 24,
            color: "#9B1B30",
            fontWeight: 600,
          }}
        >
          nemovia.it
        </div>
      </div>
    ),
    {
      ...size,
    }
  );
}
