import Link from "next/link";

/* A visitor who mistypes a URL should land somewhere that still sells, not on
   the framework's stock error screen. Colours are inherited from globals.css
   so this page follows the site's own theme, including dark mode. */

export default function NotFound() {
  return (
    <main
      style={{
        minHeight: "100dvh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: "18px",
        padding: "48px 24px",
        textAlign: "center",
      }}
    >
      <p style={{ fontSize: "0.82rem", letterSpacing: "0.14em", textTransform: "uppercase", opacity: 0.6 }}>
        Error 404
      </p>
      <h1 style={{ fontSize: "clamp(1.8rem, 5vw, 2.8rem)", fontWeight: 600, lineHeight: 1.15, maxWidth: "18ch" }}>
        That page doesn&rsquo;t exist.
      </h1>
      <p style={{ opacity: 0.72, maxWidth: "42ch", lineHeight: 1.6 }}>
        The link may be out of date, or the address slightly off. Everything is still on the home page.
      </p>
      <Link
        href="/"
        style={{
          marginTop: "10px",
          display: "inline-flex",
          alignItems: "center",
          padding: "13px 26px",
          borderRadius: "999px",
          background: "#34c3d6",
          color: "#0d1418",
          fontWeight: 600,
          textDecoration: "none",
        }}
      >
        Back to home
      </Link>
    </main>
  );
}