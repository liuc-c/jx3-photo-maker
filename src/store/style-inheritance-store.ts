import { create } from "zustand";
import { persist } from "zustand/middleware";
import { DEFAULT_FONT_FAMILY } from "./font-store";

export type StrokeStyle = "outline" | "shadow" | "hybrid";

export interface InheritedTextStyle {
	fontFamily: string;
	fontSize: number;
	fontWeight: number;
	charSpacing: number;
	opacity: number;
	vertical: boolean;
	scaleX: number;
	scaleY: number;
	strokeEnabled: boolean;
	strokeStyle: StrokeStyle;
	strokeColor: string;
	strokeWidth: number;
}

const DEFAULT_INHERITED_STYLE: InheritedTextStyle = {
	fontFamily: DEFAULT_FONT_FAMILY,
	fontSize: 100,
	fontWeight: 700,
	charSpacing: 0,
	opacity: 1,
	vertical: true,
	scaleX: 1,
	scaleY: 1,
	strokeEnabled: true,
	strokeStyle: "outline",
	strokeColor: "#ffffff",
	strokeWidth: 14,
};

interface StyleInheritanceStore {
	inheritedStyle: InheritedTextStyle;
	setInheritedStyle: (style: Partial<InheritedTextStyle>) => void;
	getInheritedStyle: () => InheritedTextStyle;
}

export const useStyleInheritanceStore = create<StyleInheritanceStore>()(
	persist(
		(set, get) => ({
			inheritedStyle: DEFAULT_INHERITED_STYLE,

			setInheritedStyle: (partial) =>
				set((state) => ({
					inheritedStyle: { ...state.inheritedStyle, ...partial },
				})),

			getInheritedStyle: () => get().inheritedStyle,
		}),
		{
			name: "jx3-photo-maker:style-inheritance",
		},
	),
);
