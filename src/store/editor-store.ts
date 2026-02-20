import type { Canvas, FabricObject } from "fabric";
import { create } from "zustand";

export type ExportFormat = "png" | "jpeg";

export interface LoadedImageMeta {
	dataUrl: string;
	width: number;
	height: number;
	fileName: string;
}

interface EditorState {
	canvas: Canvas | null;
	setCanvas: (canvas: Canvas | null) => void;
	image: LoadedImageMeta | null;
	setImage: (image: LoadedImageMeta | null) => void;
	activeObject: FabricObject | null;
	setActiveObject: (obj: FabricObject | null) => void;
	activeObjectRevision: number;
	bumpActiveObjectRevision: () => void;
	previewZoom: number;
	setPreviewZoom: (zoom: number) => void;
	exportFormat: ExportFormat;
	setExportFormat: (format: ExportFormat) => void;
}

export const useEditorStore = create<EditorState>((set) => ({
	canvas: null,
	setCanvas: (canvas) => set({ canvas }),
	image: null,
	setImage: (image) => set({ image }),
	activeObject: null,
	setActiveObject: (activeObject) => set({ activeObject }),
	activeObjectRevision: 0,
	bumpActiveObjectRevision: () =>
		set((state) => ({ activeObjectRevision: state.activeObjectRevision + 1 })),
	previewZoom: 1,
	setPreviewZoom: (previewZoom) => set({ previewZoom }),
	exportFormat: "png",
	setExportFormat: (exportFormat) => set({ exportFormat }),
}));
