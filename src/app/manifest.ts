import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "BiteLog",
    short_name: "BiteLog",
    description: "Personal AI meal logging — estimates only, always editable.",
    start_url: "/",
    display: "standalone",
    background_color: "#faf6ef",
    theme_color: "#c93a1d",
    icons: [{ src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" }],
  };
}
