import path from "node:path";
import { fileURLToPath } from "node:url";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { VitePWA } from "vite-plugin-pwa";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// https://vite.dev/config/
export default defineConfig({
	plugins: [
		react(),
		tailwindcss(),
		VitePWA({
			strategies: "generateSW",
			registerType: "prompt",
			injectRegister: null,
			includeAssets: [
				"pwa-icon.svg",
				"vite.svg",
				"fonts/fonts.json",
				"fonts/XuanZongTi-v0.1.woff2",
				"images/icons/*.png",
			],
			manifest: {
				name: "jx3-photo-maker",
				short_name: "jx3",
				description: "纯浏览器本地运行的剑网三截图排版与打标签工具",
				theme_color: "#0b0b0f",
				background_color: "#0b0b0f",
				display: "standalone",
				scope: "/",
				start_url: "/",
				icons: [
					{
						src: "pwa-icon.svg",
						sizes: "any",
						type: "image/svg+xml",
						purpose: "any",
					},
				],
			},
			workbox: {
				cleanupOutdatedCaches: true,
				navigateFallback: "/index.html",
				globPatterns: ["**/*.{js,css,html,ico,png,svg,json}"],
				globIgnores: ["**/fonts/**/*.woff2"],
			},
		}),
	],
	resolve: {
		alias: {
			"@": path.resolve(__dirname, "./src"),
		},
	},
});
