import { ChevronDown, Download, Loader2, Search, Upload } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "@/components/ui/popover";
import { Switch } from "@/components/ui/switch";
import type { FontEntry } from "@/store/font-store";
import {
	initFontStore,
	loadCustomFont,
	loadFontFile,
	querySystemFonts,
	useFontStore,
} from "@/store/font-store";

interface FontSelectorProps {
	value: string;
	onChange: (fontFamily: string) => void;
}

const PREVIEW_TEXT = "字体预览 AaBb";

const FONT_SOURCE_PRIORITY: Record<FontEntry["source"], number> = {
	custom: 0,
	uploaded: 1,
	local: 2,
	builtin: 3,
};

export function FontSelector({ value, onChange }: FontSelectorProps) {
	const [open, setOpen] = useState(false);
	const [search, setSearch] = useState("");
	const [loadingLocal, setLoadingLocal] = useState(false);
	const [loadingAll, setLoadingAll] = useState(false);
	const fontInputRef = useRef<HTMLInputElement | null>(null);

	const builtinFonts = useFontStore((s) => s.builtinFonts);
	const uploadedFonts = useFontStore((s) => s.uploadedFonts);
	const localFonts = useFontStore((s) => s.localFonts);
	const localFontsEnabled = useFontStore((s) => s.localFontsEnabled);
	const setLocalFontsEnabled = useFontStore((s) => s.setLocalFontsEnabled);
	const addUploadedFont = useFontStore((s) => s.addUploadedFont);
	const setLocalFonts = useFontStore((s) => s.setLocalFonts);

	const customFonts = useFontStore((s) => s.customFonts);
	const customFontsLoaded = useFontStore((s) => s.customFontsLoaded);
	const fontLoadStates = useFontStore((s) => s.fontLoadStates);
	const setFontLoadState = useFontStore((s) => s.setFontLoadState);

	useEffect(() => {
		if (customFontsLoaded) return;
		void initFontStore();
	}, [customFontsLoaded]);

	const allFonts = useMemo(() => {
		const all = [...builtinFonts, ...customFonts, ...uploadedFonts];
		if (localFontsEnabled) all.push(...localFonts);

		const sorted = all
			.map((font, index) => ({ font, index }))
			.sort((a, b) => {
				const sourcePriorityDiff =
					FONT_SOURCE_PRIORITY[a.font.source] -
					FONT_SOURCE_PRIORITY[b.font.source];
				if (sourcePriorityDiff !== 0) return sourcePriorityDiff;
				return a.index - b.index;
			})
			.map(({ font }) => font);

		const seenFamilies = new Set<string>();
		return sorted.filter((font) => {
			const key = font.family.trim().toLowerCase();
			if (seenFamilies.has(key)) return false;
			seenFamilies.add(key);
			return true;
		});
	}, [builtinFonts, customFonts, uploadedFonts, localFonts, localFontsEnabled]);

	const filtered = useMemo(() => {
		if (!search.trim()) return allFonts;
		const q = search.toLowerCase();
		return allFonts.filter((f) => f.family.toLowerCase().includes(q));
	}, [allFonts, search]);

	const handleToggleLocal = useCallback(
		async (enabled: boolean) => {
			setLocalFontsEnabled(enabled);
			if (enabled && localFonts.length === 0) {
				setLoadingLocal(true);
				try {
					const fonts = await querySystemFonts();
					setLocalFonts(fonts);
				} catch {
					setLocalFontsEnabled(false);
				}
				setLoadingLocal(false);
			}
		},
		[localFonts.length, setLocalFonts, setLocalFontsEnabled],
	);

	const handleUploadFont = useCallback(
		async (file: File | null) => {
			if (!file) return;
			try {
				const familyName = await loadFontFile(file);
				addUploadedFont({ family: familyName, source: "uploaded" });
				onChange(familyName);
			} catch (err) {
				console.warn("Failed to load font:", err);
			}
		},
		[addUploadedFont, onChange],
	);

	const unloadedCustomFonts = useMemo(
		() =>
			customFonts.filter(
				(f) =>
					f.source === "custom" &&
					fontLoadStates[f.family]?.status !== "loaded" &&
					fontLoadStates[f.family]?.status !== "loading",
			),
		[customFonts, fontLoadStates],
	);

	const handleLoadAllFonts = useCallback(async () => {
		if (loadingAll || unloadedCustomFonts.length === 0) return;
		setLoadingAll(true);
		try {
			await Promise.all(
				unloadedCustomFonts.map(async (f) => {
					setFontLoadState(f.family, { status: "loading", progress: 0 });
					try {
						await loadCustomFont(f, (progress) => {
							setFontLoadState(f.family, { status: "loading", progress });
						});
						setFontLoadState(f.family, { status: "loaded", progress: 100 });
					} catch {
						setFontLoadState(f.family, { status: "error", progress: 0 });
					}
				}),
			);
		} finally {
			setLoadingAll(false);
		}
	}, [loadingAll, unloadedCustomFonts, setFontLoadState]);

	const handleSelectFont = useCallback(
		async (f: FontEntry) => {
			if (f.source === "custom") {
				const loadState = fontLoadStates[f.family];
				if (loadState?.status === "loading") return;

				if (loadState?.status !== "loaded") {
					setFontLoadState(f.family, { status: "loading", progress: 0 });
					try {
						await loadCustomFont(f, (progress) => {
							setFontLoadState(f.family, { status: "loading", progress });
						});
						setFontLoadState(f.family, { status: "loaded", progress: 100 });
						onChange(f.family);
						setOpen(false);
						setSearch("");
					} catch {
						setFontLoadState(f.family, { status: "error", progress: 0 });
					}
					return;
				}
			}

			onChange(f.family);
			setOpen(false);
			setSearch("");
		},
		[fontLoadStates, onChange, setFontLoadState],
	);

	const displayName = value.startsWith("custom-")
		? value.replace("custom-", "")
		: value;

	const currentLoadState = fontLoadStates[value];
	const isCurrentLoading = currentLoadState?.status === "loading";

	return (
		<div className="grid gap-2">
			<div className="text-xs text-muted-foreground">字体</div>
			<Popover open={open} onOpenChange={setOpen}>
				<PopoverTrigger asChild>
					<Button
						variant="outline"
						className="w-full justify-between font-normal"
						style={{ fontFamily: value }}
					>
						<span className="truncate">
							{isCurrentLoading
								? `加载中 ${currentLoadState.progress}%`
								: displayName}
						</span>
						{isCurrentLoading ? (
							<Loader2 className="size-4 shrink-0 animate-spin opacity-50" />
						) : (
							<ChevronDown className="size-4 shrink-0 opacity-50" />
						)}
					</Button>
				</PopoverTrigger>
				<PopoverContent
					className="w-[calc(100vw-1rem)] max-w-[360px] p-0"
					side="bottom"
					align="start"
				>
					<div className="flex flex-col">
						<div className="flex items-center gap-2 border-b px-3 py-2">
							<Search className="size-4 shrink-0 text-muted-foreground" />
							<Input
								value={search}
								onChange={(e) => setSearch(e.target.value)}
								placeholder="搜索字体..."
								className="h-9 border-0 p-0 shadow-none focus-visible:ring-0"
							/>
						</div>

						<div className="max-h-[320px] overflow-y-auto p-1">
							{filtered.length === 0 && (
								<div className="px-3 py-6 text-center text-sm text-muted-foreground">
									未找到匹配字体
								</div>
							)}
							{filtered.map((f) => {
								const loadState =
									f.source === "custom" ? fontLoadStates[f.family] : undefined;
								const isLoading = loadState?.status === "loading";
								const isLoaded = loadState?.status === "loaded";
								const isError = loadState?.status === "error";

								return (
									<button
										key={`${f.source}-${f.family}`}
										type="button"
										className={`relative flex min-h-10 w-full cursor-pointer items-center gap-3 overflow-hidden rounded-sm px-2 py-1.5 text-left transition-colors hover:bg-accent ${
											f.family === value ? "bg-accent" : ""
										} ${isLoading ? "pointer-events-none" : ""}`}
										onClick={() => void handleSelectFont(f)}
									>
										{isLoading && (
											<div
												className="absolute inset-y-0 left-0 bg-primary/10 transition-all duration-200"
												style={{ width: `${loadState.progress}%` }}
											/>
										)}
										<span className="relative z-10 flex shrink-0 flex-wrap items-center gap-1 text-xs text-muted-foreground">
											{f.family.startsWith("custom-")
												? f.family.replace("custom-", "")
												: f.family}
											{f.source === "uploaded" && " (已上传)"}
											{f.source === "local" && " (本地)"}
											{f.source === "custom" &&
												!isLoaded &&
												!isLoading &&
												!isError &&
												" (点击加载)"}
											{isLoading && (
												<>
													<Loader2 className="size-3 animate-spin" />
													<span>{loadState.progress}%</span>
												</>
											)}
											{isError && " (加载失败，点击重试)"}
										</span>
										{(f.source !== "custom" || isLoaded) && (
											<span
												className="relative z-10 ml-auto text-2xl"
												style={{
													fontFamily: f.family,
												}}
											>
												{PREVIEW_TEXT}
											</span>
										)}
									</button>
								);
							})}
						</div>

						<div className="flex flex-col gap-2 border-t px-3 py-2">
							{unloadedCustomFonts.length > 0 && (
								<Button
									variant="outline"
									size="sm"
									className="w-full"
									onClick={() => void handleLoadAllFonts()}
									disabled={loadingAll}
								>
									{loadingAll ? (
										<Loader2 className="size-3.5 animate-spin" />
									) : (
										<Download className="size-3.5" />
									)}
									{loadingAll ? "加载中..." : "一键加载所有字体"}
								</Button>
							)}
							<Button
								variant="outline"
								size="sm"
								className="w-full"
								onClick={() => fontInputRef.current?.click()}
							>
								<Upload className="size-3.5" />
								上传字体文件
							</Button>
							<input
								ref={fontInputRef}
								type="file"
								accept=".ttf,.otf,.woff,.woff2"
								className="hidden"
								onChange={(e) => {
									const file = e.target.files?.[0] ?? null;
									e.target.value = "";
									void handleUploadFont(file);
								}}
							/>
						</div>
					</div>
				</PopoverContent>
			</Popover>

			{"queryLocalFonts" in window && (
				<div className="flex items-center justify-between">
					<Label htmlFor="local-fonts-toggle" className="text-xs font-normal">
						{loadingLocal ? "加载系统字体中..." : "使用系统字体"}
					</Label>
					<Switch
						id="local-fonts-toggle"
						checked={localFontsEnabled}
						onCheckedChange={handleToggleLocal}
						disabled={loadingLocal}
					/>
				</div>
			)}
		</div>
	);
}
