import { ImageResponse } from "next/og";

/* Replaces the default Next.js favicon. A browser tab showing the framework's
   logo tells a visitor which template was used, not whose site this is. */

export const size = { width: 32, height: 32 };
export const contentType = "image/png";

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#34c3d6",
          color: "#0d1418",
          fontSize: 17,
          fontWeight: 700,
          fontFamily: "sans-serif",
          borderRadius: "7px",
        }}
      >
        CM
      </div>
    ),
    size
  );
}