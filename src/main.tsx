import { registerSW } from "virtual:pwa-register";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App.tsx";

const updateSW = registerSW({
	immediate: true,
	onNeedRefresh() {
		const ok = window.confirm("检测到新版本资源，是否刷新以更新？");
		if (ok) void updateSW(true);
	},
});

if ("serviceWorker" in navigator) {
	const checkForUpdates = async () => {
		if (!navigator.onLine) return;
		try {
			const reg = await navigator.serviceWorker.getRegistration();
			await reg?.update();
		} catch (err) {
			if (import.meta.env.DEV) {
				console.warn("Service worker update check failed", err);
			}
		}
	};

	window.addEventListener("focus", () => void checkForUpdates());
	window.addEventListener("online", () => void checkForUpdates());
	setInterval(() => void checkForUpdates(), 60 * 60 * 1000);
}

createRoot(document.getElementById("root")!).render(
	<StrictMode>
		<App />
	</StrictMode>,
);
