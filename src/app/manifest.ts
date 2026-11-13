import type { MetadataRoute } from "next";

/** Makes the app installable ("Agregar a pantalla de inicio"), which iPhones need for notifications. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Atsui bets",
    short_name: "Atsui bets",
    description: "La quiniela familiar de Liga MX, NFL y F1.",
    lang: "es",
    start_url: "/",
    display: "standalone",
    background_color: "#f6f3ee",
    theme_color: "#f6f3ee",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
  };
}
