import { IText, Shadow } from "fabric";
import {
	ChevronDown,
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
	MAX_PREVIEW_ZOOM,
	MIN_PREVIEW_ZOOM,
	type TextStyleSnapshot,
	useFabricEditor,
} from "@/hooks/useFabricEditor";
import { useEditorStore } from "@/store/editor-store";
import { DEFAULT_FONT_FAMILY } from "@/store/font-store";

type StrokeStyle = "outline" | "shadow" | "hybrid";

function clamp(value: number, min: number, max: number): number {
	return Math.min(max, Math.max(min, value));
}

function buildTextShadow(color: string, width: number, soft: boolean): Shadow {
	return new Shadow({
		color,
		offsetX: 0,
		offsetY: 0,
		blur: soft ? Math.max(4, Math.round(width * 2.2)) : Math.max(2, width + 1),
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
	const safeWidth = clamp(Math.round(width), 1, 20);
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
	const [fillValue, setFillValue] = useState("#ffffff");
	const [fontFamilyValue, setFontFamilyValue] = useState(DEFAULT_FONT_FAMILY);
	const [fontSizeValue, setFontSizeValue] = useState(48);
	const [fontWeightValue, setFontWeightValue] = useState(700);
	const [charSpacingValue, setCharSpacingValue] = useState(0);
	const [opacityValue, setOpacityValue] = useState(1);
	const [strokeEnabled, setStrokeEnabled] = useState(false);
	const [strokeStyleValue, setStrokeStyleValue] =
		useState<StrokeStyle>("outline");
	const [strokeColor, setStrokeColor] = useState("#ffffff");
	const [strokeWidthValue, setStrokeWidthValue] = useState(4);
	const [isVerticalValue, setIsVerticalValue] = useState(true);
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
			applyToActiveText(createStrokePatch(enabled, style, color, width));
		},
		[applyToActiveText],
	);

	useEffect(() => {
		if (!activeText) {
			return;
		}

		const vertical = isTextVertical(activeText);
		setIsVerticalValue(vertical);

		const rawText = activeText.text ?? "";
		setTextValue(vertical ? fromVerticalText(rawText) : rawText);
		setFillValue(
			typeof activeText.fill === "string" ? activeText.fill : "#ffffff",
		);
		setFontFamilyValue(activeText.fontFamily ?? DEFAULT_FONT_FAMILY);
		setFontSizeValue(activeText.fontSize ?? 48);
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
			shadow instanceof Shadow ? Math.round(shadow.blur / 2) : 4;
		setStrokeWidthValue(
			hasStroke
				? Math.max(1, Math.round(activeText.strokeWidth ?? 4))
				: Math.max(1, inferredShadowStrength),
		);
	}, [activeText]);

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
			<div className="flex h-full min-h-0">
				<div className="relative min-h-0 min-w-0 flex-1">
					<main
						ref={containerRef}
						className="flex h-full items-center justify-center overflow-auto bg-muted/20 p-4"
						aria-label="图片上传与编辑区域"
						onDragOver={(e) => e.preventDefault()}
						onDrop={async (e) => {
							e.preventDefault();
							const file = e.dataTransfer.files?.[0] ?? null;
							await onPickFile(file);
						}}
					>
						{!image && (
							<div className="flex min-h-[240px] w-[min(720px,80vw)] flex-col items-center justify-center gap-3 rounded-lg border border-dashed bg-background/80 p-6 text-center">
								<div className="text-sm text-muted-foreground">
									拖拽上传剑网三截图，或点击选择文件（纯浏览器本地处理）
								</div>
								<Button onClick={openFilePicker}>选择图片</Button>
							</div>
						)}

						<div className={image ? "relative" : "h-0 w-0 overflow-hidden"}>
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
					</main>

					{image && (
						<div className="pointer-events-none absolute bottom-4 left-4 z-20">
							<div className="pointer-events-auto flex flex-col gap-2 rounded-md border bg-background/90 p-2 shadow-sm backdrop-blur supports-[backdrop-filter]:bg-background/70">
								<div className="flex items-center gap-2 text-[11px] text-muted-foreground">
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
										onClick={() => setPreviewZoom(previewZoom - 0.1)}
									>
										<ZoomOut className="size-3.5" />
									</Button>
									<Slider
										className="w-28"
										value={[previewZoom * 100]}
										min={MIN_PREVIEW_ZOOM * 100}
										max={MAX_PREVIEW_ZOOM * 100}
										step={5}
										onValueChange={([v]) => {
											setPreviewZoom(v / 100);
										}}
									/>
									<Button
										size="icon-sm"
										variant="outline"
										title="放大"
										onClick={() => setPreviewZoom(previewZoom + 0.1)}
									>
										<ZoomIn className="size-3.5" />
									</Button>
									<div className="min-w-[56px] text-right text-xs tabular-nums text-muted-foreground">
										{Math.round(previewZoom * 100)}%
									</div>
								</div>
							</div>
						</div>
					)}
				</div>

				<aside className="h-full min-h-0 w-[360px] shrink-0 overflow-y-auto border-l bg-background p-4">
					<div className="flex flex-col gap-6">
						<div className="flex items-center justify-between">
							<div className="text-sm font-semibold">工具</div>
							<div className="flex items-center gap-2">
								<Button
									size="icon-sm"
									variant="outline"
									disabled={!image}
									onClick={handleExport}
									aria-label="导出保存"
									title="导出保存"
								>
									<Download className="size-4" />
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

						<Button
							className="w-full"
							size="lg"
							disabled={!image}
							onClick={() => addText("请输入")}
						>
							<Plus className="size-5" />
							添加文字
						</Button>

						<div className="flex gap-2">
							<Popover>
								<PopoverTrigger asChild>
									<Button
										variant="outline"
										className="flex-1 justify-start gap-2"
										disabled={!image}
									>
										<Palette className="size-4" />
										门派预设
										<ChevronDown className="ml-auto size-3.5 opacity-50" />
									</Button>
								</PopoverTrigger>
								<PopoverContent
									side="bottom"
									align="start"
									className="w-auto p-3"
								>
									<div className="mb-2 text-xs font-medium text-muted-foreground">
										点击门派图标快速添加预设文字
									</div>
									<div className="grid grid-cols-7 gap-1.5">
										{presets.map((p) => (
											<button
												key={p.key}
												type="button"
												onClick={() => addPreset(p.key)}
												className="flex items-center justify-center rounded-md border p-1.5 transition hover:scale-105 hover:border-primary/60"
												style={{ borderColor: p.color }}
												title={p.label}
											>
												<img
													src={p.icon}
													alt={p.label}
													className="size-6"
													draggable={false}
												/>
											</button>
										))}
									</div>
								</PopoverContent>
							</Popover>

							<Popover>
								<PopoverTrigger asChild>
									<Button
										variant="outline"
										className="flex-1 justify-start gap-2"
										disabled={!image}
									>
										<History className="size-4" />
										历史
										{idHistory.length > 0 && (
											<span className="ml-0.5 rounded-full bg-primary/15 px-1.5 py-0.5 text-[10px] leading-none text-primary">
												{idHistory.length}
											</span>
										)}
										<ChevronDown className="ml-auto size-3.5 opacity-50" />
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
										<div className="grid grid-cols-2 gap-1.5 max-h-[300px] overflow-y-auto">
											{idHistory.map((item) => {
												const key = buildSnapshotKey(item);
												return (
													<div
														key={key}
														className="group relative flex min-w-0 items-center gap-1 rounded-md border bg-muted/25 text-sm transition hover:border-primary/60 hover:bg-primary/5"
													>
														<button
															type="button"
															onClick={() => addTextFromSnapshot(item)}
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

						<div className="flex flex-col gap-2">
							<div className="flex gap-2">
								<div className="flex rounded-md border p-1">
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
									className="flex-1"
									disabled={!image}
									onClick={handleExport}
								>
									<Download className="size-4" />
									导出保存
								</Button>
							</div>
							{image && (
								<div className="text-xs text-muted-foreground">
									原图分辨率：{image.width}×{image.height}
								</div>
							)}
						</div>

						<div className="h-px bg-border" />

						<div className="flex flex-col gap-3">
							<div className="text-sm font-semibold">属性编辑</div>
							{!activeText && (
								<div className="text-sm text-muted-foreground">
									选中文字后可编辑内容/字体/颜色/大小等
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

									<div className="flex items-center gap-2">
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
										<div className="ml-auto">
											<ColorPickerPopover
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
										value={fontFamilyValue}
										onChange={(v) => {
											setFontFamilyValue(v);
											void setActiveFontFamily(v);
										}}
									/>

									<div className="flex flex-col gap-2">
										<div className="flex items-center gap-3">
											<div className="w-8 shrink-0 text-xs text-muted-foreground">
												字号
											</div>
											<Slider
												className="flex-1"
												value={[fontSizeValue]}
												min={10}
												max={300}
												step={1}
												onValueChange={([v]) => {
													setFontSizeValue(v);
													applyToActiveText({ fontSize: v });
												}}
											/>
											<div className="w-8 shrink-0 text-right text-xs tabular-nums text-muted-foreground">
												{Math.round(fontSizeValue)}
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
												字距
											</div>
											<Slider
												className="flex-1"
												value={[charSpacingValue]}
												min={-300}
												max={1000}
												step={10}
												onValueChange={([v]) => {
													setCharSpacingValue(v);
													applyToActiveText({ charSpacing: v });
												}}
											/>
											<div className="w-8 shrink-0 text-right text-xs tabular-nums text-muted-foreground">
												{Math.round(charSpacingValue)}
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
													<div className="flex items-center rounded-md border p-0.5">
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
														min={1}
														max={100}
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
