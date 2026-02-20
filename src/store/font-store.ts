import { create } from "zustand";

export interface FontEntry {
	family: string;
	source: "builtin" | "uploaded" | "local" | "custom";
	file?: string;
}

export type FontLoadStatus = "idle" | "loading" | "loaded" | "error";

export interface FontLoadState {
	status: FontLoadStatus;
	/** 0–100 */
	progress: number;
}

interface LocalFontData {
	family: string;
}

interface LocalFontQueryWindow extends Window {
	queryLocalFonts: () => Promise<LocalFontData[]>;
}

export const DEFAULT_FONT_FAMILY = "字库江湖古风体";

const BUILTIN_FONTS: FontEntry[] = [];

const FONT_CACHE_NAME = "jx3-font-cache";

interface FontStoreState {
	builtinFonts: FontEntry[];
	uploadedFonts: FontEntry[];
	localFonts: FontEntry[];
	localFontsEnabled: boolean;

	customFonts: FontEntry[];
	customFontsLoaded: boolean;

	fontLoadStates: Record<string, FontLoadState>;

	setLocalFontsEnabled: (enabled: boolean) => void;
	addUploadedFont: (entry: FontEntry) => void;
	setLocalFonts: (fonts: FontEntry[]) => void;
	setCustomFonts: (fonts: FontEntry[]) => void;
	setCustomFontsLoaded: (loaded: boolean) => void;
	setFontLoadState: (family: string, state: FontLoadState) => void;

	getAllFonts: () => FontEntry[];
}

export const useFontStore = create<FontStoreState>((set, get) => ({
	builtinFonts: BUILTIN_FONTS,
	uploadedFonts: [],
	localFonts: [],
	localFontsEnabled: false,
	customFonts: [],
	customFontsLoaded: false,
	fontLoadStates: {},

	setLocalFontsEnabled: (enabled) => set({ localFontsEnabled: enabled }),

	addUploadedFont: (entry) =>
		set((s) => {
			if (s.uploadedFonts.some((f) => f.family === entry.family)) return s;
			return { uploadedFonts: [...s.uploadedFonts, entry] };
		}),

	setLocalFonts: (fonts) => set({ localFonts: fonts }),

	setCustomFonts: (fonts) => set({ customFonts: fonts }),
	setCustomFontsLoaded: (loaded) => set({ customFontsLoaded: loaded }),

	setFontLoadState: (family, state) =>
		set((s) => ({
			fontLoadStates: { ...s.fontLoadStates, [family]: state },
		})),

	getAllFonts: () => {
		const s = get();
		const all = [...s.builtinFonts, ...s.customFonts, ...s.uploadedFonts];
		if (s.localFontsEnabled) all.push(...s.localFonts);
		return all;
	},
}));

export async function loadFontFile(file: File): Promise<string> {
	const buffer = await file.arrayBuffer();
	const baseName = file.name.replace(/\.[^.]+$/, "");
	const familyName = `custom-${baseName}`;

	const fontFace = new FontFace(familyName, buffer);
	await fontFace.load();
	document.fonts.add(fontFace);

	return familyName;
}

export async function querySystemFonts(): Promise<FontEntry[]> {
	if (!("queryLocalFonts" in window)) {
		throw new Error("queryLocalFonts API is not supported in this browser");
	}

	const fonts = await (window as LocalFontQueryWindow).queryLocalFonts();
	const seen = new Set<string>();
	const result: FontEntry[] = [];

	for (const f of fonts) {
		if (!seen.has(f.family)) {
			seen.add(f.family);
			result.push({ family: f.family, source: "local" });
		}
	}

	return result.sort((a, b) => a.family.localeCompare(b.family));
}

interface FontManifestEntry {
	family: string;
	file: string;
}

export async function fetchFontManifest(): Promise<FontEntry[]> {
	const res = await fetch(`${import.meta.env.BASE_URL}fonts/fonts.json`);
	if (!res.ok) return [];
	const manifest: FontManifestEntry[] = await res.json();
	return manifest.map((m) => ({
		family: m.family,
		source: "custom" as const,
		file: m.file,
	}));
}

export function loadCustomFont(
	entry: FontEntry,
	onProgress?: (progress: number) => void,
): Promise<string> {
	return new Promise((resolve, reject) => {
		if (!entry.file) {
			reject(new Error("FontEntry has no file field"));
			return;
		}

		const url = `${import.meta.env.BASE_URL}fonts/${entry.file}`;
		const xhr = new XMLHttpRequest();
		xhr.open("GET", url, true);
		xhr.responseType = "arraybuffer";

		xhr.onprogress = (e) => {
			if (e.lengthComputable) {
				const pct = Math.round((e.loaded / e.total) * 100);
				onProgress?.(pct);
			}
		};

		xhr.onload = async () => {
			if (xhr.status < 200 || xhr.status >= 300) {
				reject(new Error(`Failed to fetch font: ${xhr.status}`));
				return;
			}
			try {
				const buffer = xhr.response as ArrayBuffer;
				const fontFace = new FontFace(entry.family, buffer);
				await fontFace.load();
				document.fonts.add(fontFace);
				onProgress?.(100);

				try {
					const cache = await caches.open(FONT_CACHE_NAME);
					await cache.put(url, new Response(buffer.slice(0)));
				} catch (cacheError) {
					if (import.meta.env.DEV) {
						console.warn("Failed to cache font response", cacheError);
					}
				}

				resolve(entry.family);
			} catch (err) {
				reject(err);
			}
		};

		xhr.onerror = () => reject(new Error("Network error loading font"));
		xhr.send();
	});
}

export async function restoreCachedFonts(
	entries: FontEntry[],
	setFontLoadState: (family: string, state: FontLoadState) => void,
): Promise<void> {
	if (!("caches" in window)) return;

	let cache: Cache;
	try {
		cache = await caches.open(FONT_CACHE_NAME);
	} catch {
		return;
	}

	await Promise.all(
		entries
			.filter((e) => e.source === "custom" && e.file)
			.map(async (entry) => {
				const url = `${import.meta.env.BASE_URL}fonts/${entry.file}`;
				try {
					const response = await cache.match(url);
					if (!response) return;

					const buffer = await response.arrayBuffer();
					const fontFace = new FontFace(entry.family, buffer);
					await fontFace.load();
					document.fonts.add(fontFace);
					setFontLoadState(entry.family, { status: "loaded", progress: 100 });
				} catch (restoreError) {
					if (import.meta.env.DEV) {
						console.warn("Failed to restore cached font", restoreError);
					}
				}
			}),
	);
}

export async function initFontStore(): Promise<void> {
	const {
		customFontsLoaded,
		setCustomFonts,
		setCustomFontsLoaded,
		setFontLoadState,
	} = useFontStore.getState();
	if (customFontsLoaded) return;

	const fonts = await fetchFontManifest();
	setCustomFonts(fonts);
	setCustomFontsLoaded(true);
	await restoreCachedFonts(fonts, setFontLoadState);
}

void initFontStore();
