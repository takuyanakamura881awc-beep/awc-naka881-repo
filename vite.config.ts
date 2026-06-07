/// <reference types="vitest/config" />
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

// PWA: インストール可能・オフライン動作。サーバなしで完全動作する静的アプリ。
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["favicon.svg"],
      manifest: {
        name: "Stable Saga — 育成シミュレーション",
        short_name: "Stable Saga",
        description: "自分だけの競走馬を作成・育成してレースに挑む育成シミュレーション",
        theme_color: "#1b5e20",
        background_color: "#0f1a14",
        display: "standalone",
        orientation: "portrait",
        lang: "ja",
        start_url: "/",
        icons: [
          { src: "icon-192.png", sizes: "192x192", type: "image/png" },
          { src: "icon-512.png", sizes: "512x512", type: "image/png" },
          {
            src: "icon-512-maskable.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "maskable",
          },
        ],
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,svg,png,woff2}"],
      },
    }),
  ],
  test: {
    globals: true,
    environment: "node",
  },
});
