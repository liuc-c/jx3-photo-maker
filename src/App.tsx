import { IText, Shadow } from "fabric";
import {
	Download,
	Hand,
	History,
	ImagePlus,
	Moon,
	Palette,
	Plus,
	Sun,
	X,
	ZoomIn,
	ZoomOut,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { ColorPickerPopover } from "@/components/ColorPickerPopover";
import { FontSelector } from "@/components/FontSelector";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "@/components/ui/popover";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import {
	fromVerticalText,
	isTextVertical,
	type TextStyleSnapshot,
	useFabricEditor,
} from "@/hooks/useFabricEditor";
import { cn } from "@/lib/utils";
import { useEditorStore } from "@/store/editor-store";
import { DEFAULT_FONT_FAMILY } from "@/store/font-store";
import { useStyleInheritanceStore } from "@/store/style-inheritance-store";

type StrokeStyle = "outline" | "shadow" | "hybrid";

const STROKE_WIDTH_MIN = 1;
const STROKE_WIDTH_MAX = 32;
const BASE_TEXT_FONT_SIZE = 100;

function clamp(value: number, min: number, max: number): number {
	return Math.min(max, Math.max(min, value));
}

function toPercentScale(scale: number): number {
	return Math.round(scale * 100);
}

function toScaleFromPercent(percent: number): number {
	return percent / 100;
}

const ZOOM_LOG_STEP = 0.1;
const ZOOM_RULER_TICK_SPACING = 16;
const ZOOM_DRAG_SENSITIVITY = 0.01;
const SIGNED_RULER_STEP = 20;
const SIGNED_RULER_DRAG_SENSITIVITY = 0.8;

function toPositiveValue(value: number, fallback: number): number {
	if (!Number.isFinite(value)) return fallback;
	return value > 0 ? value : fallback;
}

function normalizeStrokeWidth(width: number): number {
	return clamp(Math.round(width), STROKE_WIDTH_MIN, STROKE_WIDTH_MAX);
}

function getShadowBlur(width: number, soft: boolean): number {
	const safeWidth = normalizeStrokeWidth(width);
	return soft
		? Math.max(4, Math.round(safeWidth * 3.2))
		: Math.max(2, Math.round(safeWidth * 1.8 + 1));
}

interface InfiniteScaleRulerProps {
	value: number;
	onValueChange: (nextValue: number) => void;
	ariaLabel: string;
	resetValue: number;
	ariaValueNow?: number;
	className?: string;
}

function InfiniteScaleRuler({
	value,
	onValueChange,
	ariaLabel,
	resetValue,
	ariaValueNow,
	className,
}: InfiniteScaleRulerProps) {
	const dragRef = useRef<{
		pointerId: number;
		startX: number;
		startValue: number;
	} | null>(null);
	const safeValue = toPositiveValue(value, resetValue);
	const offset =
		((Math.log(safeValue) / ZOOM_LOG_STEP) * ZOOM_RULER_TICK_SPACING) %
		ZOOM_RULER_TICK_SPACING;

	const updateFromDrag = useCallback(
		(clientX: number) => {
			const state = dragRef.current;
			if (!state) return;
			const deltaX = clientX - state.startX;
			onValueChange(
				toPositiveValue(
					state.startValue * Math.exp(deltaX * ZOOM_DRAG_SENSITIVITY),
					resetValue,
				),
			);
		},
		[onValueChange, resetValue],
	);

	return (
		<div
			className={cn(
				"relative h-8 w-32 touch-none overflow-hidden rounded-md border bg-muted/30",
				className,
			)}
			role="slider"
			aria-label={ariaLabel}
			aria-valuemin={1}
			aria-valuenow={ariaValueNow ?? Math.round(safeValue * 100)}
			tabIndex={0}
			onDoubleClick={() => onValueChange(resetValue)}
			onPointerDown={(event) => {
				dragRef.current = {
					pointerId: event.pointerId,
					startX: event.clientX,
					startValue: safeValue,
				};
				event.currentTarget.setPointerCapture(event.pointerId);
			}}
			onPointerMove={(event) => {
				if (dragRef.current?.pointerId !== event.pointerId) return;
				updateFromDrag(event.clientX);
			}}
			onPointerUp={(event) => {
				if (dragRef.current?.pointerId !== event.pointerId) return;
				dragRef.current = null;
				event.currentTarget.releasePointerCapture(event.pointerId);
			}}
			onPointerCancel={(event) => {
				if (dragRef.current?.pointerId !== event.pointerId) return;
				dragRef.current = null;
				event.currentTarget.releasePointerCapture(event.pointerId);
			}}
			onKeyDown={(event) => {
				if (event.key === "ArrowLeft") {
					event.preventDefault();
					onValueChange(safeValue / 1.05);
				}
				if (event.key === "ArrowRight") {
					event.preventDefault();
					onValueChange(safeValue * 1.05);
				}
			}}
		>
			<div
				className="pointer-events-none absolute inset-0"
				style={{
					backgroundImage:
						"repeating-linear-gradient(90deg, hsl(var(--border)) 0 1px, transparent 1px 8px), repeating-linear-gradient(90deg, transparent 0 15px, hsl(var(--muted-foreground) / 0.45) 15px 16px)",
					backgroundPositionX: `${offset}px, ${offset}px`,
				}}
			/>
			<div className="pointer-events-none absolute inset-y-0 left-1/2 w-px -translate-x-1/2 bg-primary" />
		</div>
	);
}

interface InfiniteSignedRulerProps {
	value: number;
	onValueChange: (nextValue: number) => void;
	ariaLabel: string;
	resetValue: number;
	ariaValueNow?: number;
	className?: string;
}

function InfiniteSignedRuler({
	value,
	onValueChange,
	ariaLabel,
	resetValue,
	ariaValueNow,
	className,
}: InfiniteSignedRulerProps) {
	const dragRef = useRef<{
		pointerId: number;
		startX: number;
		startValue: number;
	} | null>(null);
	const offset =
		((value / SIGNED_RULER_STEP) * ZOOM_RULER_TICK_SPACING) %
		ZOOM_RULER_TICK_SPACING;

	const updateFromDrag = useCallback(
		(clientX: number) => {
			const state = dragRef.current;
			if (!state) return;
			const deltaX = clientX - state.startX;
			onValueChange(
				Math.round(state.startValue + deltaX * SIGNED_RULER_DRAG_SENSITIVITY),
			);
		},
		[onValueChange],
	);

	return (
		<div
			className={cn(
				"relative h-8 w-32 touch-none overflow-hidden rounded-md border bg-muted/30",
				className,
			)}
			role="slider"
			aria-label={ariaLabel}
			aria-valuenow={ariaValueNow ?? Math.round(value)}
			tabIndex={0}
			onDoubleClick={() => onValueChange(resetValue)}
			onPointerDown={(event) => {
				dragRef.current = {
					pointerId: event.pointerId,
					startX: event.clientX,
					startValue: value,
				};
				event.currentTarget.setPointerCapture(event.pointerId);
			}}
			onPointerMove={(event) => {
				if (dragRef.current?.pointerId !== event.pointerId) return;
				updateFromDrag(event.clientX);
			}}
			onPointerUp={(event) => {
				if (dragRef.current?.pointerId !== event.pointerId) return;
				dragRef.current = null;
				event.currentTarget.releasePointerCapture(event.pointerId);
			}}
			onPointerCancel={(event) => {
				if (dragRef.current?.pointerId !== event.pointerId) return;
				dragRef.current = null;
				event.currentTarget.releasePointerCapture(event.pointerId);
			}}
			onKeyDown={(event) => {
				if (event.key === "ArrowLeft") {
					event.preventDefault();
					onValueChange(value - 1);
				}
				if (event.key === "ArrowRight") {
					event.preventDefault();
					onValueChange(value + 1);
				}
			}}
		>
			<div
				className="pointer-events-none absolute inset-0"
				style={{
					backgroundImage:
						"repeating-linear-gradient(90deg, hsl(var(--border)) 0 1px, transparent 1px 8px), repeating-linear-gradient(90deg, transparent 0 15px, hsl(var(--muted-foreground) / 0.45) 15px 16px)",
					backgroundPositionX: `${offset}px, ${offset}px`,
				}}
			/>
			<div className="pointer-events-none absolute inset-y-0 left-1/2 w-px -translate-x-1/2 bg-primary" />
		</div>
	);
}

function buildTextShadow(color: string, width: number, soft: boolean): Shadow {
	return new Shadow({
		color,
		offsetX: 0,
		offsetY: 0,
		blur: getShadowBlur(width, soft),
	});
}

function getStrokeStyleFromText(text: IText): StrokeStyle {
	const hasStroke = !!text.stroke && (text.strokeWidth ?? 0) > 0;
	const hasShadow = !!text.shadow;
	if (hasShadow && hasStroke) return "hybrid";
	if (hasShadow) return "shadow";
	return "outline";
}

function readShadowColor(shadow: IText["shadow"]): string | null {
	if (!shadow) return null;
	return typeof shadow.color === "string" ? shadow.color : null;
}

function createStrokePatch(
	enabled: boolean,
	style: StrokeStyle,
	color: string,
	width: number,
) {
	const safeWidth = normalizeStrokeWidth(width);
	if (!enabled) {
		return {
			stroke: null,
			strokeWidth: 0,
			shadow: null,
		};
	}

	if (style === "outline") {
		return {
			stroke: color,
			strokeWidth: safeWidth,
			shadow: null,
			paintFirst: "stroke" as const,
		};
	}

	if (style === "shadow") {
		return {
			stroke: null,
			strokeWidth: 0,
			shadow: buildTextShadow(color, safeWidth, true),
			paintFirst: "fill" as const,
		};
	}

	return {
		stroke: color,
		strokeWidth: Math.max(1, Math.round(safeWidth * 0.6)),
		shadow: buildTextShadow(color, safeWidth, false),
		paintFirst: "stroke" as const,
	};
}

function buildSnapshotKey(snapshot: TextStyleSnapshot): string {
	return JSON.stringify([
		snapshot.text,
		snapshot.vertical,
		snapshot.fill,
		snapshot.fontFamily,
		snapshot.fontSize,
		snapshot.scaleX,
		snapshot.scaleY,
		snapshot.fontWeight,
		snapshot.charSpacing,
		snapshot.opacity,
		snapshot.stroke,
		snapshot.strokeWidth,
		snapshot.shadowColor,
		snapshot.shadowBlur,
		snapshot.paintFirst,
	]);
}

function mergeUniqueSnapshots(
	current: TextStyleSnapshot[],
	incoming: TextStyleSnapshot[],
): TextStyleSnapshot[] {
	if (incoming.length === 0) return current;

	const seen = new Set(current.map((item) => buildSnapshotKey(item)));
	const additions: TextStyleSnapshot[] = [];

	for (const snapshot of incoming) {
		const key = buildSnapshotKey(snapshot);
		if (seen.has(key)) continue;
		seen.add(key);
		additions.push(snapshot);
	}

	if (additions.length === 0) return current;
	return [...additions, ...current].slice(0, 40);
}

function useTheme() {
	const [dark, setDark] = useState(() => {
		if (typeof document === "undefined") return false;
		const saved = localStorage.getItem("theme");
		if (saved) return saved === "dark";
		return window.matchMedia("(prefers-color-scheme: dark)").matches;
	});

	useEffect(() => {
		document.documentElement.classList.toggle("dark", dark);
	}, [dark]);

	useEffect(() => {
		if (localStorage.getItem("theme")) return;
		const mq = window.matchMedia("(prefers-color-scheme: dark)");
		const handler = (e: MediaQueryListEvent) => setDark(e.matches);
		mq.addEventListener("change", handler);
		return () => mq.removeEventListener("change", handler);
	}, []);

	const toggle = useCallback(() => {
		setDark((prev) => {
			const next = !prev;
			localStorage.setItem("theme", next ? "dark" : "light");
			return next;
		});
	}, []);

	return { dark, toggle };
}

const HISTORY_STORAGE_KEY = "jx3-photo-maker:id-history";

function App() {
	const fileInputRef = useRef<HTMLInputElement | null>(null);
	const activeObject = useEditorStore((s) => s.activeObject);
	const activeObjectRevision = useEditorStore((s) => s.activeObjectRevision);
	const exportFormat = useEditorStore((s) => s.exportFormat);
	const setExportFormat = useEditorStore((s) => s.setExportFormat);

	const {
		canvasElRef,
		containerRef,
		image,
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
	} = useFabricEditor();

	const { dark, toggle: toggleTheme } = useTheme();

	const activeText = activeObject instanceof IText ? activeObject : null;

	const [textValue, setTextValue] = useState("");
	const [fillValue, setFillValue] = useState("#000000");
	const [fontFamilyValue, setFontFamilyValue] = useState(DEFAULT_FONT_FAMILY);
	const [textScaleValue, setTextScaleValue] = useState(100);
	const [fontWeightValue, setFontWeightValue] = useState(700);
	const [charSpacingValue, setCharSpacingValue] = useState(0);
	const [opacityValue, setOpacityValue] = useState(1);
	const [strokeEnabled, setStrokeEnabled] = useState(false);
	const [strokeStyleValue, setStrokeStyleValue] =
		useState<StrokeStyle>("outline");
	const [strokeColor, setStrokeColor] = useState("#ffffff");
	const [strokeWidthValue, setStrokeWidthValue] = useState(4);
	const [isVerticalValue, setIsVerticalValue] = useState(true);
	const [presetPopoverOpen, setPresetPopoverOpen] = useState(false);
	const [historyPopoverOpen, setHistoryPopoverOpen] = useState(false);
	const [popoverEpoch, setPopoverEpoch] = useState(0);
	const [isDesktop, setIsDesktop] = useState(() => {
		if (typeof window === "undefined") return false;
		return window.matchMedia("(min-width: 1024px)").matches;
	});
	const [idHistory, setIdHistory] = useState<TextStyleSnapshot[]>(() => {
		try {
			const stored = localStorage.getItem(HISTORY_STORAGE_KEY);
			if (stored) return JSON.parse(stored) as TextStyleSnapshot[];
		} catch {
			/* ignore */
		}
		return [];
	});

	const applyStrokeStyle = useCallback(
		(enabled: boolean, style: StrokeStyle, color: string, width: number) => {
			const safeWidth = normalizeStrokeWidth(width);
			applyToActiveText(createStrokePatch(enabled, style, color, safeWidth));
			useStyleInheritanceStore.getState().setInheritedStyle({
				strokeEnabled: enabled,
				strokeStyle: style,
				strokeColor: color,
				strokeWidth: safeWidth,
			});
		},
		[applyToActiveText],
	);

	const applyTextScale = useCallback(
		(nextValue: number) => {
			const nextScalePercent = Math.max(
				1,
				Math.round(toPositiveValue(nextValue, 100)),
			);
			setTextScaleValue(nextScalePercent);
			applyToActiveText({
				fontSize: BASE_TEXT_FONT_SIZE,
				scaleX: toScaleFromPercent(nextScalePercent),
				scaleY: toScaleFromPercent(nextScalePercent),
			});
		},
		[applyToActiveText],
	);

	const applyCharSpacing = useCallback(
		(nextValue: number) => {
			const normalized = Math.round(nextValue);
			setCharSpacingValue(normalized);
			applyToActiveText({ charSpacing: normalized });
		},
		[applyToActiveText],
	);

	const closeAllPopovers = useCallback(() => {
		setPresetPopoverOpen(false);
		setHistoryPopoverOpen(false);
		setPopoverEpoch((v) => v + 1);
	}, []);

	useEffect(() => {
		if (!activeText) {
			return;
		}
		if (!Number.isFinite(activeObjectRevision)) {
			return;
		}

		const vertical = isTextVertical(activeText);
		// eslint-disable-next-line react-hooks/set-state-in-effect
		setIsVerticalValue(vertical);

		const rawText = activeText.text ?? "";
		setTextValue(vertical ? fromVerticalText(rawText) : rawText);
		setFillValue(
			typeof activeText.fill === "string" ? activeText.fill : "#000000",
		);
		setFontFamilyValue(activeText.fontFamily ?? DEFAULT_FONT_FAMILY);
		const effectiveScaleX =
			((activeText.fontSize ?? BASE_TEXT_FONT_SIZE) / BASE_TEXT_FONT_SIZE) *
			(activeText.scaleX ?? 1);
		const effectiveScaleY =
			((activeText.fontSize ?? BASE_TEXT_FONT_SIZE) / BASE_TEXT_FONT_SIZE) *
			(activeText.scaleY ?? 1);
		const uniformScale = (effectiveScaleX + effectiveScaleY) / 2;
		const nextScalePercent = Math.max(1, toPercentScale(uniformScale));
		setTextScaleValue(nextScalePercent);
		setFontWeightValue(
			typeof activeText.fontWeight === "number"
				? activeText.fontWeight
				: Number(activeText.fontWeight ?? 700),
		);
		setCharSpacingValue(activeText.charSpacing ?? 0);
		setOpacityValue(activeText.opacity ?? 1);

		const hasStroke = !!activeText.stroke && (activeText.strokeWidth ?? 0) > 0;
		const hasShadow = !!activeText.shadow;
		setStrokeEnabled(hasStroke || hasShadow);
		setStrokeStyleValue(getStrokeStyleFromText(activeText));

		const shadow = activeText.shadow;
		const shadowColor = readShadowColor(shadow);
		setStrokeColor(
			typeof activeText.stroke === "string"
				? activeText.stroke
				: (shadowColor ?? "#ffffff"),
		);

		const inferredShadowStrength =
			shadow instanceof Shadow
				? normalizeStrokeWidth(Math.round(shadow.blur / 2))
				: 4;
		setStrokeWidthValue(
			hasStroke
				? normalizeStrokeWidth(Math.round(activeText.strokeWidth ?? 4))
				: Math.max(1, inferredShadowStrength),
		);

		useStyleInheritanceStore.getState().setInheritedStyle({
			fontFamily: activeText.fontFamily ?? DEFAULT_FONT_FAMILY,
			fontSize: BASE_TEXT_FONT_SIZE,
			fontWeight:
				typeof activeText.fontWeight === "number"
					? activeText.fontWeight
					: Number(activeText.fontWeight ?? 700),
			charSpacing: activeText.charSpacing ?? 0,
			opacity: activeText.opacity ?? 1,
			vertical,
			scaleX: toScaleFromPercent(nextScalePercent),
			scaleY: toScaleFromPercent(nextScalePercent),
		});
	}, [activeObjectRevision, activeText]);

	useEffect(() => {
		if (!activeText) return;
		// eslint-disable-next-line react-hooks/set-state-in-effect
		closeAllPopovers();
	}, [activeText, closeAllPopovers]);

	useEffect(() => {
		const media = window.matchMedia("(min-width: 1024px)");
		const onChange = () => setIsDesktop(media.matches);
		onChange();
		media.addEventListener("change", onChange);
		return () => media.removeEventListener("change", onChange);
	}, []);

	function openFilePicker() {
		fileInputRef.current?.click();
	}

	useEffect(() => {
		try {
			localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(idHistory));
		} catch {
			/* ignore */
		}
	}, [idHistory]);

	async function onPickFile(file: File | null) {
		if (!file) return;
		await loadLocalImage(file);
	}

	const captureCurrentIds = useCallback(() => {
		const snapshots = getAllTextSnapshots();
		setIdHistory((prev) => mergeUniqueSnapshots(prev, snapshots));
	}, [getAllTextSnapshots]);

	const removeHistoryItem = useCallback((key: string) => {
		setIdHistory((prev) =>
			prev.filter((item) => buildSnapshotKey(item) !== key),
		);
	}, []);

	const handleExport = useCallback(async () => {
		captureCurrentIds();
		await exportImage(exportFormat);
	}, [captureCurrentIds, exportFormat, exportImage]);

	const strokeWidthLabel =
		strokeStyleValue === "outline"
			? "描边粗细"
			: strokeStyleValue === "shadow"
				? "阴影强度"
				: "描边/阴影强度";

	return (
		<div className="h-svh w-full overflow-hidden bg-background text-foreground">
			<div className="flex h-full min-h-0 flex-col lg:flex-row">
				<div className="relative min-h-0 min-w-0 flex-1">
					<main
						ref={containerRef}
						className="h-full overflow-auto bg-muted/20 p-2 sm:p-4"
						aria-label="图片上传与编辑区域"
						onDragOver={(e) => e.preventDefault()}
						onDrop={async (e) => {
							e.preventDefault();
							const file = e.dataTransfer.files?.[0] ?? null;
							await onPickFile(file);
						}}
					>
						<div className="flex min-h-full min-w-full">
							{!image && (
								<div className="m-auto flex min-h-[220px] w-full max-w-[720px] shrink-0 flex-col items-center justify-center gap-3 rounded-lg border border-dashed bg-background/80 p-4 text-center sm:p-6">
									<div className="text-sm text-muted-foreground">
										拖拽上传剑网三截图，或点击选择文件（纯浏览器本地处理）
									</div>
									<Button onClick={openFilePicker}>选择图片</Button>
								</div>
							)}

							<div
								className={
									image ? "relative m-auto shrink-0" : "h-0 w-0 overflow-hidden"
								}
							>
								<canvas ref={canvasElRef} className="rounded-lg shadow-sm" />
							</div>

							<input
								ref={fileInputRef}
								type="file"
								accept="image/*"
								className="hidden"
								onChange={async (e) => {
									const file = e.target.files?.[0] ?? null;
									e.target.value = "";
									await onPickFile(file);
								}}
							/>
						</div>
					</main>

					{!isDesktop && (
						<div className="pointer-events-none absolute right-2 top-2 z-20">
							<Button
								className="pointer-events-auto bg-background/85 backdrop-blur supports-[backdrop-filter]:bg-background/65"
								size="icon-sm"
								variant="outline"
								onClick={toggleTheme}
								aria-label="切换主题"
								title="切换主题"
							>
								{dark ? (
									<Sun className="size-4" />
								) : (
									<Moon className="size-4" />
								)}
							</Button>
						</div>
					)}

					{image && (
						<div className="pointer-events-none absolute bottom-2 left-1/2 z-20 w-[calc(100%-1rem)] -translate-x-1/2 lg:bottom-4 lg:left-4 lg:w-auto lg:translate-x-0">
							<div className="pointer-events-auto flex flex-col gap-2 rounded-md border bg-background/90 p-2 shadow-sm backdrop-blur supports-[backdrop-filter]:bg-background/70">
								<div className="hidden items-center gap-2 text-[11px] text-muted-foreground lg:flex">
									<Hand className="size-3.5" />
									<span>空格+拖拽 / 中键拖拽查看</span>
								</div>
								<div className="flex items-center gap-2">
									<Button
										size="icon-sm"
										variant="outline"
										title="导入新图片"
										onClick={openFilePicker}
									>
										<ImagePlus className="size-3.5" />
									</Button>
									<div className="h-4 w-px bg-border" />
									<Button
										size="icon-sm"
										variant="outline"
										title="缩小"
										onClick={() => setPreviewZoom(previewZoom / 1.1)}
									>
										<ZoomOut className="size-3.5" />
									</Button>
									<InfiniteScaleRuler
										value={previewZoom}
										onValueChange={setPreviewZoom}
										ariaLabel="画布缩放刻度"
										resetValue={1}
										ariaValueNow={Math.round(previewZoom * 100)}
									/>
									<Button
										size="icon-sm"
										variant="outline"
										title="放大"
										onClick={() => setPreviewZoom(previewZoom * 1.1)}
									>
										<ZoomIn className="size-3.5" />
									</Button>
									<div className="min-w-[48px] text-right text-xs tabular-nums text-muted-foreground sm:min-w-[56px]">
										{Math.round(previewZoom * 100)}%
									</div>
								</div>
							</div>
						</div>
					)}
				</div>

				<aside className="min-h-0 h-[44svh] w-full shrink-0 overflow-y-auto border-t bg-background p-3 pb-[calc(env(safe-area-inset-bottom)+0.75rem)] sm:h-[50svh] sm:p-4 lg:h-full lg:w-[360px] lg:border-t-0 lg:border-l lg:p-4">
					<div className="flex flex-col gap-4 sm:gap-6">
						<div className="flex flex-col gap-4 sm:gap-6">
							{isDesktop && (
								<>
									<div className="flex items-center justify-between">
										<div className="text-sm font-semibold">工具</div>
										<div className="flex items-center gap-2">
											<Button
												size="sm"
												variant="outline"
												onClick={openFilePicker}
												aria-label="导入图片"
												title="导入图片"
											>
												<ImagePlus className="size-4" />
												选择图片
											</Button>
											<Button
												size="icon-sm"
												variant="ghost"
												onClick={toggleTheme}
												aria-label="切换主题"
											>
												{dark ? (
													<Sun className="size-4" />
												) : (
													<Moon className="size-4" />
												)}
											</Button>
										</div>
									</div>
									{image && (
										<div className="text-xs text-muted-foreground">
											原图分辨率：{image.width}×{image.height}
										</div>
									)}
								</>
							)}

							{!isDesktop && (
								<div className="rounded-xl border bg-muted/20 p-1.5">
									<div className="flex flex-wrap items-center gap-1.5">
										<Button
											size="icon-xs"
											disabled={!image}
											onClick={() => addText("请输入")}
											title="添加文字"
											aria-label="添加文字"
										>
											<Plus className="size-3.5" />
										</Button>

										<Popover
											open={presetPopoverOpen}
											onOpenChange={(open) => {
												setPresetPopoverOpen(open);
												if (open) setHistoryPopoverOpen(false);
											}}
										>
											<PopoverTrigger asChild>
												<Button
													variant="outline"
													size="icon-xs"
													disabled={!image}
													title="门派预设"
													aria-label="门派预设"
												>
													<Palette className="size-3.5" />
												</Button>
											</PopoverTrigger>
											<PopoverContent
												side="bottom"
												align="start"
												className="w-[calc(100vw-1rem)] max-w-[360px] p-3 data-[state=open]:animate-none data-[state=closed]:animate-none"
											>
												<div className="mb-2 text-xs font-medium text-muted-foreground">
													点击门派图标快速添加预设文字
												</div>
												<div className="grid grid-cols-4 gap-2 sm:grid-cols-7 sm:gap-1.5">
													{presets.map((p) => (
														<button
															key={p.key}
															type="button"
															onClick={() => {
																addPreset(p.key);
															}}
															className="flex min-h-10 items-center justify-center rounded-md border p-1.5 transition hover:scale-105 hover:border-primary/60"
															style={{ borderColor: p.color }}
															title={p.label}
														>
															<img
																src={p.icon}
																alt={p.label}
																className="size-7"
																draggable={false}
															/>
														</button>
													))}
												</div>
											</PopoverContent>
										</Popover>

										<Popover
											open={historyPopoverOpen}
											onOpenChange={(open) => {
												setHistoryPopoverOpen(open);
												if (open) setPresetPopoverOpen(false);
											}}
										>
											<PopoverTrigger asChild>
												<Button
													variant="outline"
													size="icon-xs"
													className="relative"
													disabled={!image}
													title="历史"
													aria-label="历史"
												>
													<History className="size-3.5" />
													{idHistory.length > 0 && (
														<span className="absolute -right-1 -top-1 rounded-full bg-primary px-1 text-[10px] leading-4 text-primary-foreground">
															{idHistory.length}
														</span>
													)}
												</Button>
											</PopoverTrigger>
											<PopoverContent
												side="bottom"
												align="end"
												className="w-[calc(100vw-1rem)] max-w-[360px] p-3 data-[state=open]:animate-none data-[state=closed]:animate-none"
											>
												<div className="mb-2 text-xs text-muted-foreground">
													导出时自动记录当前图片的 ID 样式，点击可一键复用
												</div>
												{idHistory.length === 0 && (
													<div className="rounded-md border border-dashed p-3 text-xs text-muted-foreground">
														暂无历史记录，先导出一次即可生成
													</div>
												)}
												{idHistory.length > 0 && (
													<div className="grid max-h-[300px] grid-cols-1 gap-1.5 overflow-y-auto sm:grid-cols-2">
														{idHistory.map((item) => {
															const key = buildSnapshotKey(item);
															return (
																<div
																	key={key}
																	className="group relative flex min-w-0 items-center gap-1 rounded-md border bg-muted/25 text-sm transition hover:border-primary/60 hover:bg-primary/5"
																>
																	<button
																		type="button"
																		onClick={() => {
																			addTextFromSnapshot(item);
																		}}
																		className="flex min-w-0 flex-1 items-center gap-1.5 px-2 py-1.5 text-left"
																	>
																		{item.presetKey &&
																			(() => {
																				const preset = presets.find(
																					(p) => p.key === item.presetKey,
																				);
																				return preset ? (
																					<img
																						src={preset.icon}
																						alt={preset.label}
																						className="size-4 shrink-0"
																						draggable={false}
																					/>
																				) : null;
																			})()}
																		<span
																			className="truncate"
																			style={{
																				color: item.fill,
																				fontFamily: item.fontFamily,
																				fontWeight: item.fontWeight,
																			}}
																		>
																			{item.text || "[空]"}
																		</span>
																	</button>
																	<button
																		type="button"
																		onClick={(e) => {
																			e.stopPropagation();
																			removeHistoryItem(key);
																		}}
																		className="shrink-0 p-1 text-muted-foreground opacity-100 transition hover:text-destructive sm:opacity-0 sm:group-hover:opacity-100"
																		title="删除"
																	>
																		<X className="size-3" />
																	</button>
																</div>
															);
														})}
													</div>
												)}
											</PopoverContent>
										</Popover>

										<div className="ml-auto flex items-center rounded-md border p-0.5">
											<Button
												type="button"
												size="xs"
												variant="ghost"
												disabled={!image}
												onClick={handleExport}
												title={exportFormat === "png" ? "导出 PNG" : "导出 JPG"}
												aria-label={
													exportFormat === "png" ? "导出 PNG" : "导出 JPG"
												}
												className="px-2"
											>
												<Download className="size-3.5" />
												导出
											</Button>
											<div className="mx-0.5 h-4 w-px bg-border" />
											<Button
												type="button"
												size="xs"
												variant={exportFormat === "png" ? "default" : "ghost"}
												onClick={() => setExportFormat("png")}
												title="导出 PNG"
											>
												PNG
											</Button>
											<Button
												type="button"
												size="xs"
												variant={exportFormat === "jpeg" ? "default" : "ghost"}
												onClick={() => setExportFormat("jpeg")}
												title="导出 JPG"
											>
												JPG
											</Button>
										</div>
									</div>
								</div>
							)}

							{isDesktop && (
								<div className="flex flex-col gap-2">
									<div className="flex items-center gap-2">
										<Button
											className="flex-1"
											disabled={!image}
											onClick={() => addText("请输入")}
										>
											<Plus className="size-4" />
											添加文字
										</Button>
										<div className="flex rounded-md border p-0.5">
											<Button
												type="button"
												size="xs"
												variant={exportFormat === "png" ? "default" : "ghost"}
												onClick={() => setExportFormat("png")}
												title="导出 PNG"
											>
												PNG
											</Button>
											<Button
												type="button"
												size="xs"
												variant={exportFormat === "jpeg" ? "default" : "ghost"}
												onClick={() => setExportFormat("jpeg")}
												title="导出 JPG"
											>
												JPG
											</Button>
										</div>
										<Button
											variant="outline"
											disabled={!image}
											onClick={handleExport}
										>
											<Download className="size-4" />
											导出
										</Button>
									</div>

									<div className="flex items-center gap-2">
										<Popover
											open={presetPopoverOpen}
											onOpenChange={(open) => {
												setPresetPopoverOpen(open);
												if (open) setHistoryPopoverOpen(false);
											}}
										>
											<PopoverTrigger asChild>
												<Button
													variant="outline"
													className="flex-1 justify-start"
													disabled={!image}
												>
													<Palette className="size-4" />
													门派预设
												</Button>
											</PopoverTrigger>
											<PopoverContent
												side="bottom"
												align="start"
												className="w-[320px] p-3"
											>
												<div className="mb-2 text-xs font-medium text-muted-foreground">
													点击门派图标快速添加预设文字
												</div>
												<div className="grid grid-cols-7 gap-1.5">
													{presets.map((p) => (
														<button
															key={p.key}
															type="button"
															onClick={() => {
																addPreset(p.key);
															}}
															className="flex min-h-10 items-center justify-center rounded-md border p-1.5 transition hover:scale-105 hover:border-primary/60"
															style={{ borderColor: p.color }}
															title={p.label}
														>
															<img
																src={p.icon}
																alt={p.label}
																className="size-7"
																draggable={false}
															/>
														</button>
													))}
												</div>
											</PopoverContent>
										</Popover>

										<Popover
											open={historyPopoverOpen}
											onOpenChange={(open) => {
												setHistoryPopoverOpen(open);
												if (open) setPresetPopoverOpen(false);
											}}
										>
											<PopoverTrigger asChild>
												<Button
													variant="outline"
													className="flex-1 justify-start"
													disabled={!image}
												>
													<History className="size-4" />
													历史
													{idHistory.length > 0 && (
														<span className="ml-0.5 rounded-full bg-primary/15 px-1.5 py-0.5 text-[10px] leading-none text-primary">
															{idHistory.length}
														</span>
													)}
												</Button>
											</PopoverTrigger>
											<PopoverContent
												side="bottom"
												align="end"
												className="w-[320px] p-3"
											>
												<div className="mb-2 text-xs text-muted-foreground">
													导出时自动记录当前图片的 ID 样式，点击可一键复用
												</div>
												{idHistory.length === 0 && (
													<div className="rounded-md border border-dashed p-3 text-xs text-muted-foreground">
														暂无历史记录，先导出一次即可生成
													</div>
												)}
												{idHistory.length > 0 && (
													<div className="grid max-h-[300px] grid-cols-2 gap-1.5 overflow-y-auto">
														{idHistory.map((item) => {
															const key = buildSnapshotKey(item);
															return (
																<div
																	key={key}
																	className="group relative flex min-w-0 items-center gap-1 rounded-md border bg-muted/25 text-sm transition hover:border-primary/60 hover:bg-primary/5"
																>
																	<button
																		type="button"
																		onClick={() => {
																			addTextFromSnapshot(item);
																		}}
																		className="flex min-w-0 flex-1 items-center gap-1.5 px-2 py-1.5 text-left"
																	>
																		{item.presetKey &&
																			(() => {
																				const preset = presets.find(
																					(p) => p.key === item.presetKey,
																				);
																				return preset ? (
																					<img
																						src={preset.icon}
																						alt={preset.label}
																						className="size-4 shrink-0"
																						draggable={false}
																					/>
																				) : null;
																			})()}
																		<span
																			className="truncate"
																			style={{
																				color: item.fill,
																				fontFamily: item.fontFamily,
																				fontWeight: item.fontWeight,
																			}}
																		>
																			{item.text || "[空]"}
																		</span>
																	</button>
																	<button
																		type="button"
																		onClick={(e) => {
																			e.stopPropagation();
																			removeHistoryItem(key);
																		}}
																		className="shrink-0 p-1 text-muted-foreground opacity-0 transition hover:text-destructive group-hover:opacity-100"
																		title="删除"
																	>
																		<X className="size-3" />
																	</button>
																</div>
															);
														})}
													</div>
												)}
											</PopoverContent>
										</Popover>
									</div>
								</div>
							)}
						</div>

						<div className="h-px bg-border" />

						<div className="flex flex-col gap-3">
							<div className="text-sm font-semibold">属性编辑</div>
							{!activeText && (
								<div className="text-sm text-muted-foreground">
									选中文字后在右侧编辑内容/字体/颜色/大小
								</div>
							)}

							{activeText && (
								<div className="flex flex-col gap-4">
									<div className="grid gap-2">
										<div className="text-xs font-medium text-primary">
											ID 内容
										</div>
										<Input
											className="border-primary bg-primary/10 text-foreground focus-visible:border-primary focus-visible:ring-primary/30"
											placeholder="输入角色 ID..."
											value={textValue}
											onChange={(e) => {
												setTextValue(e.target.value);
												applyToActiveText({ text: e.target.value });
											}}
										/>
									</div>

									<div className="flex flex-wrap items-center gap-2">
										<div className="text-xs text-muted-foreground">排版</div>
										<div className="flex items-center rounded-md border p-0.5">
											<Button
												type="button"
												size="xs"
												variant={!isVerticalValue ? "default" : "ghost"}
												onClick={() => {
													setIsVerticalValue(false);
													setActiveTextVertical(false);
												}}
											>
												横排
											</Button>
											<Button
												type="button"
												size="xs"
												variant={isVerticalValue ? "default" : "ghost"}
												onClick={() => {
													setIsVerticalValue(true);
													setActiveTextVertical(true);
												}}
											>
												竖排
											</Button>
										</div>
										<div className="ml-auto sm:ml-auto">
											<ColorPickerPopover
												key={`fill-color-popover-${popoverEpoch}`}
												label="颜色"
												color={fillValue}
												onChange={(c) => {
													setFillValue(c);
													applyToActiveText({ fill: c });
												}}
											/>
										</div>
									</div>

									<FontSelector
										key={`font-selector-${popoverEpoch}`}
										value={fontFamilyValue}
										onChange={(v) => {
											setFontFamilyValue(v);
											void setActiveFontFamily(v);
										}}
									/>

									<div className="flex flex-col gap-2">
										<div className="flex items-center gap-3">
											<div className="w-8 shrink-0 text-xs text-muted-foreground">
												缩放
											</div>
											<Button
												size="icon-xs"
												variant="outline"
												title="缩小文字"
												onClick={() => applyTextScale(textScaleValue / 1.05)}
											>
												<ZoomOut className="size-3.5" />
											</Button>
											<InfiniteScaleRuler
												value={textScaleValue}
												onValueChange={applyTextScale}
												ariaLabel="文字缩放刻度"
												resetValue={100}
												ariaValueNow={textScaleValue}
												className="h-8 flex-1"
											/>
											<Button
												size="icon-xs"
												variant="outline"
												title="放大文字"
												onClick={() => applyTextScale(textScaleValue * 1.05)}
											>
												<ZoomIn className="size-3.5" />
											</Button>
											<div className="w-12 shrink-0 text-right text-xs tabular-nums text-muted-foreground">
												{textScaleValue}%
											</div>
										</div>

										<div className="flex items-center gap-3">
											<div className="w-8 shrink-0 text-xs text-muted-foreground">
												字距
											</div>
											<Button
												size="icon-xs"
												variant="outline"
												title="减小字距"
												onClick={() => applyCharSpacing(charSpacingValue - 10)}
											>
												<ZoomOut className="size-3.5" />
											</Button>
											<InfiniteSignedRuler
												value={charSpacingValue}
												onValueChange={applyCharSpacing}
												ariaLabel="文字字距刻度"
												resetValue={0}
												ariaValueNow={charSpacingValue}
												className="h-8 flex-1"
											/>
											<Button
												size="icon-xs"
												variant="outline"
												title="增大字距"
												onClick={() => applyCharSpacing(charSpacingValue + 10)}
											>
												<ZoomIn className="size-3.5" />
											</Button>
											<div className="w-12 shrink-0 text-right text-xs tabular-nums text-muted-foreground">
												{Math.round(charSpacingValue)}
											</div>
										</div>

										<div className="flex items-center gap-3">
											<div className="w-8 shrink-0 text-xs text-muted-foreground">
												粗细
											</div>
											<Slider
												className="flex-1"
												value={[fontWeightValue]}
												min={100}
												max={900}
												step={100}
												onValueChange={([v]) => {
													setFontWeightValue(v);
													applyToActiveText({ fontWeight: v });
												}}
											/>
											<div className="w-8 shrink-0 text-right text-xs tabular-nums text-muted-foreground">
												{Math.round(fontWeightValue)}
											</div>
										</div>

										<div className="flex items-center gap-3">
											<div className="w-8 shrink-0 text-xs text-muted-foreground">
												透明
											</div>
											<Slider
												className="flex-1"
												value={[opacityValue * 100]}
												min={0}
												max={100}
												step={1}
												onValueChange={([v]) => {
													setOpacityValue(v / 100);
													applyToActiveText({ opacity: v / 100 });
												}}
											/>
											<div className="w-8 shrink-0 text-right text-xs tabular-nums text-muted-foreground">
												{Math.round(opacityValue * 100)}
											</div>
										</div>
									</div>

									<div className="grid gap-2">
										<div className="flex items-center justify-between">
											<Label
												htmlFor="stroke-toggle"
												className="text-xs font-normal text-muted-foreground"
											>
												描边效果
											</Label>
											<Switch
												id="stroke-toggle"
												checked={strokeEnabled}
												onCheckedChange={(checked) => {
													setStrokeEnabled(checked);
													applyStrokeStyle(
														checked,
														strokeStyleValue,
														strokeColor,
														strokeWidthValue,
													);
												}}
											/>
										</div>
										{strokeEnabled && (
											<div className="flex flex-col gap-3 rounded-md border p-3">
												<div className="grid gap-2">
													<div className="text-xs text-muted-foreground">
														描边样式
													</div>
													<div className="grid grid-cols-3 items-center rounded-md border p-0.5">
														<Button
															type="button"
															size="xs"
															className="flex-1"
															variant={
																strokeStyleValue === "outline"
																	? "default"
																	: "ghost"
															}
															onClick={() => {
																setStrokeStyleValue("outline");
																applyStrokeStyle(
																	true,
																	"outline",
																	strokeColor,
																	strokeWidthValue,
																);
															}}
														>
															描边
														</Button>
														<Button
															type="button"
															size="xs"
															className="flex-1"
															variant={
																strokeStyleValue === "shadow"
																	? "default"
																	: "ghost"
															}
															onClick={() => {
																setStrokeStyleValue("shadow");
																applyStrokeStyle(
																	true,
																	"shadow",
																	strokeColor,
																	strokeWidthValue,
																);
															}}
														>
															阴影
														</Button>
														<Button
															type="button"
															size="xs"
															className="flex-1"
															variant={
																strokeStyleValue === "hybrid"
																	? "default"
																	: "ghost"
															}
															onClick={() => {
																setStrokeStyleValue("hybrid");
																applyStrokeStyle(
																	true,
																	"hybrid",
																	strokeColor,
																	strokeWidthValue,
																);
															}}
														>
															混合
														</Button>
													</div>
												</div>

												<ColorPickerPopover
													key={`stroke-color-popover-${popoverEpoch}`}
													label="描边颜色"
													color={strokeColor}
													showSchoolPresets={false}
													onChange={(c) => {
														setStrokeColor(c);
														applyStrokeStyle(
															true,
															strokeStyleValue,
															c,
															strokeWidthValue,
														);
													}}
												/>

												<div className="flex items-center gap-3">
													<div className="shrink-0 text-xs text-muted-foreground">
														{strokeWidthLabel}
													</div>
													<Slider
														value={[strokeWidthValue]}
														min={STROKE_WIDTH_MIN}
														max={STROKE_WIDTH_MAX}
														step={1}
														onValueChange={([v]) => {
															setStrokeWidthValue(v);
															applyStrokeStyle(
																true,
																strokeStyleValue,
																strokeColor,
																v,
															);
														}}
													/>
													<div className="w-6 shrink-0 text-right text-xs tabular-nums text-muted-foreground">
														{strokeWidthValue}
													</div>
												</div>
											</div>
										)}
									</div>

									<Button variant="destructive" onClick={deleteActiveObject}>
										删除
									</Button>
								</div>
							)}
						</div>
					</div>
				</aside>
			</div>
		</div>
	);
}

export default App;
