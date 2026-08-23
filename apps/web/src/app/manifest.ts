import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "DTLAHappening",
    short_name: "DTLA",
    description: "Every gallery, rooftop and warehouse opening in Downtown Los Angeles.",
    start_url: "/",
    // `standalone` removes the browser chrome — added to the home screen it
    // opens full-screen with no URL bar, which is the whole point.
    display: "standalone",
    orientation: "portrait",
    background_color: "#0a0a0c",
    theme_color: "#0a0a0c",
    categories: ["events", "entertainment", "lifestyle"],
    icons: [
      { src: "/icon/192", sizes: "192x192", type: "image/png" },
      { src: "/icon/512", sizes: "512x512", type: "image/png" },
      // `maskable` lets Android crop to its own shape without clipping the mark.
      { src: "/icon/512", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
