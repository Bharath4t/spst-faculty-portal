import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["logo.png"], // Ensures your logo is cached
      manifest: {
        name: "SPST Faculty Portal",
        short_name: "SPST Faculty",
        description: "Faculty Attendance & Leave Management",
        theme_color: "#1e3a8a", // Your Brand Blue
        background_color: "#ffffff",
        display: "standalone", // This hides the browser URL bar
        orientation: "portrait",
        scope: "/",
        start_url: "/",
        icons: [
          {
            src: "/logo.png", // Uses your new 512x512 logo
            sizes: "512x512",
            type: "image/png",
            purpose: "any maskable",
          },
        ],
      },
    }),
  ],
});
