import type { FabricObject } from "fabric";
import { Canvas, FabricImage, IText, Shadow } from "fabric";
import FontFaceObserver from "fontfaceobserver";
import { useEffect, useMemo, useRef } from "react";
import type { SchoolPreset } from "@/constants/colors";
import { JX3_SCHOOL_PRESETS } from "@/constants/colors";
import { useResizeObserver } from "@/hooks/useResizeObserver";
import { fileToDataURL, loadImageElement } from "@/lib/file";
import { useEditorStore } from "@/store/editor-store";
import {
	DEFAULT_FONT_FAMILY,
	fetchFontManifest,
	loadCustomFont,
	useFontStore,
} from "@/store/font-store";

export type { SchoolPreset as Preset };

export interface TextStyleSnapshot {
	text: string;
	vertical: boolean;
	fill: string;
	fontFamily: string;
	fontSize: number;
	fontWeight: number;
	charSpacing: number;
	opacity: number;
	stroke: string | null;
	strokeWidth: number;
	shadowColor: string | null;
	shadowBlur: number;
	paintFirst: "fill" | "stroke";
	presetKey?: string;
}

function isEditableText(obj: FabricObject | null): obj is IText {
	return !!obj && obj.type === "i-text";
}

function isTypingTarget(target: EventTarget | null): boolean {
	if (!(target instanceof HTMLElement)) return false;
	if (target.isContentEditable) return true;

	const tag = target.tagName.toLowerCase();
	return tag === "input" || tag === "textarea" || tag === "select";
}

function toVerticalText(text: string): string {
	return text.split("").join("\n");
}

function fromVerticalText(text: string): string {
	return text.replace(/\n/g, "");
}

// WeakMap avoids polluting fabric object serialisation
const verticalMap = new WeakMap<IText, boolean>();
const presetKeyMap = new WeakMap<IText, string>();

export function isTextVertical(obj: IText): boolean {
	return verticalMap.get(obj) ?? false;
}

export { toVerticalText, fromVerticalText };

function clamp(value: number, min: number, max: number): number {
	return Math.min(max, Math.max(min, value));
}

const DEFAULT_TEXT_LINE_HEIGHT = 1.16;
const MIN_TEXT_LINE_HEIGHT = 0.2;

function getVerticalLineHeight(charSpacing: number): number {
	return clamp(
		DEFAULT_TEXT_LINE_HEIGHT + charSpacing / 1000,
		MIN_TEXT_LINE_HEIGHT,
		10,
	);
}

const MIN_PREVIEW_ZOOM = 0.5;
const MAX_PREVIEW_ZOOM = 3;

export { MIN_PREVIEW_ZOOM, MAX_PREVIEW_ZOOM };

export function useFabricEditor() {
	const canvasElRef = useRef<HTMLCanvasElement | null>(null);
	const containerRef = useRef<HTMLDivElement | null>(null);

	const containerSize = useResizeObserver(containerRef);

	const canvas = useEditorStore((s) => s.canvas);
	const setCanvas = useEditorStore((s) => s.setCanvas);
	const image = useEditorStore((s) => s.image);
	const setImage = useEditorStore((s) => s.setImage);
	const setActiveObject = useEditorStore((s) => s.setActiveObject);
	const previewZoom = useEditorStore((s) => s.previewZoom);
	const setPreviewZoomRaw = useEditorStore((s) => s.setPreviewZoom);
	const panStateRef = useRef<{
		active: boolean;
		startX: number;
		startY: number;
		scrollLeft: number;
		scrollTop: number;
	}>({
		active: false,
		startX: 0,
		startY: 0,
		scrollLeft: 0,
		scrollTop: 0,
	});
	const spacePressedRef = useRef(false);

	const customFontsLoaded = useFontStore((s) => s.customFontsLoaded);
	const setCustomFonts = useFontStore((s) => s.setCustomFonts);
	const setCustomFontsLoaded = useFontStore((s) => s.setCustomFontsLoaded);

	const fitScale = useMemo(() => {
		if (!image) return 1;
		if (!containerSize.width || !containerSize.height) return 1;
		const scale = Math.min(
			containerSize.width / image.width,
			containerSize.height / image.height,
		);
		return Number.isFinite(scale) && scale > 0 ? Math.min(scale, 1) : 1;
	}, [containerSize.height, containerSize.width, image]);

	const displayScale = useMemo(
		() => fitScale * clamp(previewZoom, MIN_PREVIEW_ZOOM, MAX_PREVIEW_ZOOM),
		[fitScale, previewZoom],
	);

	useEffect(() => {
		const el = canvasElRef.current;
		if (!el) return;

		const c = new Canvas(el, {
			enableRetinaScaling: false,
			preserveObjectStacking: true,
			selection: true,
		});

		c.on("selection:created", () =>
			setActiveObject(c.getActiveObject() ?? null),
		);
		c.on("selection:updated", () =>
			setActiveObject(c.getActiveObject() ?? null),
		);
		c.on("selection:cleared", () => setActiveObject(null));

		setCanvas(c);
		return () => {
			setCanvas(null);
			c.dispose();
		};
	}, [setActiveObject, setCanvas]);

	useEffect(() => {
		if (customFontsLoaded) return;

		let cancelled = false;
		void fetchFontManifest().then((fonts) => {
			if (cancelled) return;
			setCustomFonts(fonts);
			setCustomFontsLoaded(true);
		});

		return () => {
			cancelled = true;
		};
	}, [customFontsLoaded, setCustomFonts, setCustomFontsLoaded]);

	useEffect(() => {
		const { customFonts, fontLoadStates, setFontLoadState } =
			useFontStore.getState();
		const defaultEntry = customFonts.find(
			(font) => font.family === DEFAULT_FONT_FAMILY,
		);
		if (!defaultEntry) return;

		const loadState = fontLoadStates[DEFAULT_FONT_FAMILY]?.status;
		if (loadState === "loaded" || loadState === "loading") return;

		setFontLoadState(DEFAULT_FONT_FAMILY, { status: "loading", progress: 0 });
		void loadCustomFont(defaultEntry, (progress) => {
			setFontLoadState(DEFAULT_FONT_FAMILY, {
				status: "loading",
				progress,
			});
		})
			.then(() => {
				setFontLoadState(DEFAULT_FONT_FAMILY, {
					status: "loaded",
					progress: 100,
				});
				canvas?.requestRenderAll();
			})
			.catch(() => {
				setFontLoadState(DEFAULT_FONT_FAMILY, {
					status: "error",
					progress: 0,
				});
			});
	}, [canvas, customFontsLoaded]);

	useEffect(() => {
		if (!canvas) return;

		const handleTextChanged = ({
			target,
		}: {
			target?: FabricObject | null;
		}) => {
			const candidate = target ?? null;
			if (!isEditableText(candidate)) return;
			if (!verticalMap.get(candidate)) return;

			const currentText = candidate.text ?? "";
			const normalizedText = toVerticalText(fromVerticalText(currentText));
			if (normalizedText === currentText) return;

			candidate.set({ text: normalizedText });
			candidate.setCoords();
			canvas.requestRenderAll();
		};

		canvas.on("text:changed", handleTextChanged);
		return () => {
			canvas.off("text:changed", handleTextChanged);
		};
	}, [canvas]);

	useEffect(() => {
		if (!canvas || !image) return;

		const cssW = `${Math.round(image.width * displayScale)}px`;
		const cssH = `${Math.round(image.height * displayScale)}px`;

		canvas.setDimensions({ width: cssW, height: cssH }, { cssOnly: true });
		canvas.calcOffset();
		canvas.requestRenderAll();
	}, [canvas, displayScale, image]);

	useEffect(() => {
		const onKeyDown = (event: KeyboardEvent) => {
			if (isTypingTarget(event.target)) return;

			if (event.code === "Space") {
				if (image && previewZoom > 1) {
					event.preventDefault();
					spacePressedRef.current = true;
					const container = containerRef.current;
					if (container) container.style.cursor = "grab";
				}
				return;
			}

			if (event.code === "Delete" || event.code === "Backspace") {
				const state = useEditorStore.getState();
				const c = state.canvas;
				if (!c) return;
				const activeObjects = c.getActiveObjects();
				if (!activeObjects.length) return;
				if (activeObjects.length === 1) {
					const only = activeObjects[0] ?? null;
					if (only instanceof IText && only.isEditing) return;
				}
				event.preventDefault();
				c.discardActiveObject();
				for (const obj of activeObjects) c.remove(obj);
				state.setActiveObject(null);
				c.requestRenderAll();
			}
		};

		const onKeyUp = (event: KeyboardEvent) => {
			if (event.code !== "Space") return;

			if (!isTypingTarget(event.target) && image && previewZoom > 1) {
				event.preventDefault();
			}

			spacePressedRef.current = false;
			const container = containerRef.current;
			if (container) container.style.cursor = "default";
		};

		window.addEventListener("keydown", onKeyDown);
		window.addEventListener("keyup", onKeyUp);

		return () => {
			window.removeEventListener("keydown", onKeyDown);
			window.removeEventListener("keyup", onKeyUp);
		};
	}, [image, previewZoom]);

	useEffect(() => {
		const container = containerRef.current;
		if (!container || !image) return;

		const setCursor = () => {
			if (panStateRef.current.active) {
				container.style.cursor = "grabbing";
				return;
			}

			container.style.cursor = spacePressedRef.current ? "grab" : "default";
		};

		const stopPan = () => {
			if (!panStateRef.current.active) return;
			panStateRef.current.active = false;
			setCursor();
		};

		const onPointerDown = (event: PointerEvent) => {
			if (previewZoom <= 1) return;
			const useMiddleButton = event.button === 1;
			const useSpaceLeftButton = event.button === 0 && spacePressedRef.current;
			if (!useMiddleButton && !useSpaceLeftButton) return;

			event.preventDefault();
			panStateRef.current = {
				active: true,
				startX: event.clientX,
				startY: event.clientY,
				scrollLeft: container.scrollLeft,
				scrollTop: container.scrollTop,
			};

			setCursor();
		};

		const onPointerMove = (event: PointerEvent) => {
			if (!panStateRef.current.active) return;
			event.preventDefault();

			const dx = event.clientX - panStateRef.current.startX;
			const dy = event.clientY - panStateRef.current.startY;

			container.scrollLeft = panStateRef.current.scrollLeft - dx;
			container.scrollTop = panStateRef.current.scrollTop - dy;
		};

		const onPointerUp = () => {
			stopPan();
		};

		const onBlur = () => {
			stopPan();
		};

		const onAuxClick = (event: MouseEvent) => {
			if (event.button === 1) {
				event.preventDefault();
			}
		};

		setCursor();
		container.addEventListener("pointerdown", onPointerDown);
		window.addEventListener("pointermove", onPointerMove, { passive: false });
		window.addEventListener("pointerup", onPointerUp);
		window.addEventListener("blur", onBlur);
		container.addEventListener("auxclick", onAuxClick);

		return () => {
			container.removeEventListener("pointerdown", onPointerDown);
			window.removeEventListener("pointermove", onPointerMove);
			window.removeEventListener("pointerup", onPointerUp);
			window.removeEventListener("blur", onBlur);
			container.removeEventListener("auxclick", onAuxClick);
			container.style.cursor = "default";
		};
	}, [image, previewZoom]);

	async function loadLocalImage(file: File) {
		if (!canvas) return;

		const dataUrl = await fileToDataURL(file);
		const imgEl = await loadImageElement(dataUrl);

		const w = imgEl.naturalWidth;
		const h = imgEl.naturalHeight;

		const nextFitScale =
			containerSize.width && containerSize.height
				? Math.min(containerSize.width / w, containerSize.height / h, 1)
				: 1;
		const nextDisplayScale =
			nextFitScale * clamp(previewZoom, MIN_PREVIEW_ZOOM, MAX_PREVIEW_ZOOM);

		canvas.clear();
		setActiveObject(null);
		canvas.setViewportTransform([1, 0, 0, 1, 0, 0]);
		canvas.setDimensions({ width: w, height: h });
		canvas.setDimensions(
			{
				width: `${Math.round(w * nextDisplayScale)}px`,
				height: `${Math.round(h * nextDisplayScale)}px`,
			},
			{ cssOnly: true },
		);

		const bg = await FabricImage.fromURL(dataUrl, { crossOrigin: "anonymous" });
		bg.set({
			left: 0,
			top: 0,
			originX: "left",
			originY: "top",
			selectable: false,
			evented: false,
			lockMovementX: true,
			lockMovementY: true,
			lockRotation: true,
			lockScalingX: true,
			lockScalingY: true,
			objectCaching: false,
			scaleX: 1,
			scaleY: 1,
		});

		canvas.set("backgroundImage", bg);
		canvas.requestRenderAll();

		setImage({
			dataUrl,
			width: w,
			height: h,
			fileName: file.name,
		});
	}

	function addText(text: string, color = "#ffffff", presetKey?: string) {
		if (!canvas || !image) return;
		const verticalContent = toVerticalText(text);
		const it = new IText(verticalContent, {
			left: image.width / 2,
			top: image.height / 2,
			originX: "center",
			originY: "center",
			editable: false,
			fill: color,
			fontFamily: DEFAULT_FONT_FAMILY,
			fontSize: Math.max(
				24,
				Math.round(Math.min(image.width, image.height) * 0.05),
			),
			fontWeight: 700,
			charSpacing: 0,
			lineHeight: getVerticalLineHeight(0),
			opacity: 1,
			objectCaching: false,
			textAlign: "center",
		});
		verticalMap.set(it, true);
		if (presetKey) presetKeyMap.set(it, presetKey);
		canvas.add(it);
		canvas.setActiveObject(it);
		setActiveObject(it);
		canvas.requestRenderAll();
	}

	function readSnapshotFromText(obj: IText): TextStyleSnapshot {
		const vertical = isTextVertical(obj);
		const rawText = obj.text ?? "";
		const flatText = vertical ? fromVerticalText(rawText) : rawText;
		const shadow = obj.shadow;
		const shadowColor =
			shadow && typeof shadow === "object" && typeof shadow.color === "string"
				? shadow.color
				: null;
		const shadowBlur =
			shadow && typeof shadow === "object" && typeof shadow.blur === "number"
				? Math.max(0, Math.round(shadow.blur))
				: 0;

		const snapshot: TextStyleSnapshot = {
			text: flatText,
			vertical,
			fill: typeof obj.fill === "string" ? obj.fill : "#ffffff",
			fontFamily: obj.fontFamily ?? DEFAULT_FONT_FAMILY,
			fontSize: Math.max(10, Math.round(obj.fontSize ?? 48)),
			fontWeight:
				typeof obj.fontWeight === "number"
					? obj.fontWeight
					: Number(obj.fontWeight ?? 700),
			charSpacing: Math.round(obj.charSpacing ?? 0),
			opacity: Number(obj.opacity ?? 1),
			stroke: typeof obj.stroke === "string" ? obj.stroke : null,
			strokeWidth: Math.max(0, Math.round(obj.strokeWidth ?? 0)),
			shadowColor,
			shadowBlur,
			paintFirst: obj.paintFirst === "fill" ? "fill" : "stroke",
		};

		const pk = presetKeyMap.get(obj);
		if (pk) snapshot.presetKey = pk;

		return snapshot;
	}

	function getAllTextSnapshots(): TextStyleSnapshot[] {
		if (!canvas) return [];
		return canvas
			.getObjects()
			.filter((obj): obj is IText => isEditableText(obj))
			.map((obj) => readSnapshotFromText(obj));
	}

	function addTextFromSnapshot(snapshot: TextStyleSnapshot) {
		if (!canvas || !image) return;

		const nextText = snapshot.vertical
			? toVerticalText(snapshot.text)
			: snapshot.text;
		let nextShadow: IText["shadow"] | null = null;
		if (snapshot.shadowColor && snapshot.shadowBlur > 0) {
			nextShadow = new Shadow({
				color: snapshot.shadowColor,
				offsetX: 0,
				offsetY: 0,
				blur: snapshot.shadowBlur,
			});
		}

		const textObject = new IText(nextText, {
			left: image.width / 2,
			top: image.height / 2,
			originX: "center",
			originY: "center",
			editable: false,
			fill: snapshot.fill,
			fontFamily: snapshot.fontFamily,
			fontSize: snapshot.fontSize,
			fontWeight: snapshot.fontWeight,
			charSpacing: snapshot.charSpacing,
			opacity: snapshot.opacity,
			stroke: snapshot.stroke,
			strokeWidth: snapshot.strokeWidth,
			shadow: nextShadow,
			paintFirst: snapshot.paintFirst,
			objectCaching: false,
			textAlign: snapshot.vertical ? "center" : "left",
		});

		verticalMap.set(textObject, snapshot.vertical);
		if (snapshot.presetKey) presetKeyMap.set(textObject, snapshot.presetKey);
		canvas.add(textObject);
		canvas.setActiveObject(textObject);
		setActiveObject(textObject);
		textObject.setCoords();
		canvas.requestRenderAll();
	}

	type ActiveTextPatch = Partial<
		Pick<
			IText,
			| "text"
			| "fill"
			| "fontFamily"
			| "fontSize"
			| "fontWeight"
			| "charSpacing"
			| "lineHeight"
			| "opacity"
			| "stroke"
			| "strokeWidth"
			| "shadow"
			| "paintFirst"
		>
	> & {
		stroke?: IText["stroke"] | null;
		shadow?: IText["shadow"] | null;
	};

	function applyToActiveText(patch: ActiveTextPatch) {
		if (!canvas) return;
		const obj = canvas.getActiveObject() ?? null;
		if (!isEditableText(obj)) return;
		const isVertical = verticalMap.get(obj) ?? false;

		if (patch.text !== undefined && isVertical) {
			patch = { ...patch, text: toVerticalText(patch.text) };
		}

		if (patch.charSpacing !== undefined && isVertical) {
			patch = {
				...patch,
				lineHeight: getVerticalLineHeight(patch.charSpacing),
			};
		}

		if (patch.fill !== undefined && typeof patch.fill === "string") {
			const matchedPreset = JX3_SCHOOL_PRESETS.find(
				(p) => p.color.toLowerCase() === patch.fill!.toString().toLowerCase(),
			);
			if (matchedPreset) {
				presetKeyMap.set(obj, matchedPreset.key);
			}
		}

		obj.set(patch);
		obj.setCoords();
		canvas.requestRenderAll();
	}

	function setActiveTextVertical(vertical: boolean) {
		if (!canvas) return;
		const obj = canvas.getActiveObject() ?? null;
		if (!isEditableText(obj)) return;

		const wasVertical = verticalMap.get(obj) ?? false;
		if (vertical === wasVertical) return;

		const flat = fromVerticalText(obj.text ?? "");
		const newText = vertical ? toVerticalText(flat) : flat;

		verticalMap.set(obj, vertical);
		obj.set({
			text: newText,
			textAlign: vertical ? "center" : "left",
			lineHeight: vertical
				? getVerticalLineHeight(obj.charSpacing ?? 0)
				: DEFAULT_TEXT_LINE_HEIGHT,
		});
		obj.setCoords();
		canvas.requestRenderAll();
	}

	async function setActiveFontFamily(fontFamily: string) {
		const { customFonts, fontLoadStates, setFontLoadState } =
			useFontStore.getState();
		const customEntry = customFonts.find((f) => f.family === fontFamily);

		if (customEntry && fontLoadStates[fontFamily]?.status !== "loaded") {
			setFontLoadState(fontFamily, { status: "loading", progress: 0 });
			try {
				await loadCustomFont(customEntry, (progress) => {
					setFontLoadState(fontFamily, { status: "loading", progress });
				});
				setFontLoadState(fontFamily, { status: "loaded", progress: 100 });
			} catch {
				setFontLoadState(fontFamily, { status: "error", progress: 0 });
				return;
			}
		}

		applyToActiveText({ fontFamily });
		try {
			await new FontFaceObserver(fontFamily).load(null, 5000);
			canvas?.requestRenderAll();
		} catch (err) {
			if (import.meta.env.DEV)
				console.warn("[jx3-photo-maker] font load failed:", err);
		}
	}

	function deleteActiveObject() {
		if (!canvas) return;
		const activeObjects = canvas.getActiveObjects();
		if (!activeObjects.length) return;
		canvas.discardActiveObject();
		for (const obj of activeObjects) canvas.remove(obj);
		setActiveObject(null);
		canvas.requestRenderAll();
	}

	async function exportImage(format: "png" | "jpeg") {
		if (!canvas || !image) return;

		await document.fonts.ready;

		const prevBg = canvas.backgroundColor;
		if (format === "jpeg") canvas.set("backgroundColor", "#ffffff");

		const blob = await canvas.toBlob({
			format,
			quality: format === "jpeg" ? 0.95 : 1,
			multiplier: 1,
			enableRetinaScaling: false,
		});

		canvas.set("backgroundColor", prevBg);
		canvas.requestRenderAll();

		if (!blob) return;

		const url = URL.createObjectURL(blob);
		const a = document.createElement("a");
		a.href = url;
		const ext = format === "jpeg" ? "jpg" : "png";
		a.download = `${image.fileName.replace(/\.[^.]+$/, "") || "export"}.${ext}`;
		document.body.appendChild(a);
		a.click();
		a.remove();
		URL.revokeObjectURL(url);
	}

	const presets = JX3_SCHOOL_PRESETS;

	function addPreset(presetKey: string) {
		const preset = presets.find((p) => p.key === presetKey);
		if (!preset) return;
		addText(preset.label, preset.color, preset.key);
	}

	function setPreviewZoom(zoom: number) {
		setPreviewZoomRaw(clamp(zoom, MIN_PREVIEW_ZOOM, MAX_PREVIEW_ZOOM));
	}

	return {
		canvasElRef,
		containerRef,
		image,
		displayScale,
		previewZoom,
		setPreviewZoom,
		loadLocalImage,
		addText,
		addTextFromSnapshot,
		getAllTextSnapshots,
		addPreset,
		presets,
		applyToActiveText,
		setActiveFontFamily,
		setActiveTextVertical,
		deleteActiveObject,
		exportImage,
	};
}
