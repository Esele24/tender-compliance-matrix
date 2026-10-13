import { ImageResponse } from "next/og";

/* Next.js image metadata route: render editable JSX into a PNG link-preview card.
   The explicit size, MIME type, and alt text describe the generated image. */

export const alt = "Compliance Matrix — Tender response assistant";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const NAME = "Compliance Matrix";
const TAGLINE = "Tender response assistant";
const DOMAIN = "https://tender-compliance-matrix.vercel.app".replace("https://", "");

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          background: "#0d1418",
          padding: "72px",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", width: "148px", height: "10px", background: "#34c3d6", borderRadius: "999px" }} />

        <div style={{ display: "flex", flexDirection: "column" }}>
          <div
            style={{
              display: "flex",
              fontSize: 76,
              fontWeight: 700,
              color: "#ffffff",
              lineHeight: 1.05,
              letterSpacing: "-0.02em",
            }}
          >
            {NAME}
          </div>
          <div style={{ display: "flex", fontSize: 34, color: "#34c3d6", marginTop: "22px", lineHeight: 1.25 }}>
            {TAGLINE}
          </div>
        </div>

        <div style={{ display: "flex", fontSize: 26, color: "rgba(255,255,255,0.62)" }}>{DOMAIN}</div>
      </div>
    ),
    size
  );
}