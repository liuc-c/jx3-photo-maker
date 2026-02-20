import { HexColorPicker } from "react-colorful";
import { Input } from "@/components/ui/input";
import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "@/components/ui/popover";
import { COMMON_COLORS, JX3_SCHOOL_PRESETS } from "@/constants/colors";

interface ColorPickerPopoverProps {
	label?: string;
	color: string;
	onChange: (color: string) => void;
	showSchoolPresets?: boolean;
}

export function ColorPickerPopover({
	label,
	color,
	onChange,
	showSchoolPresets = true,
}: ColorPickerPopoverProps) {
	const picker = (
		<Popover>
			<PopoverTrigger asChild>
				<button
					type="button"
					className="h-9 w-9 shrink-0 rounded border"
					style={{ backgroundColor: color }}
				/>
			</PopoverTrigger>
			<PopoverContent
				className="w-[calc(100vw-1rem)] max-w-[340px] p-3"
				side="bottom"
				align="start"
				sideOffset={8}
			>
				<div className="flex flex-col gap-3">
					<HexColorPicker color={color} onChange={onChange} />

					<div className="flex flex-col gap-1.5">
						<div className="text-xs font-medium text-muted-foreground">
							常用颜色
						</div>
						<div className="flex flex-wrap gap-1.5">
							{COMMON_COLORS.map((c) => (
								<button
									key={c.color}
									type="button"
									title={c.label}
									className={`h-8 w-8 rounded-sm border transition-transform hover:scale-110 ${
										color.toLowerCase() === c.color.toLowerCase()
											? "ring-2 ring-ring ring-offset-1"
											: ""
									}`}
									style={{ backgroundColor: c.color }}
									onClick={() => onChange(c.color)}
								/>
							))}
						</div>
					</div>

					{showSchoolPresets && (
						<div className="flex flex-col gap-1.5">
							<div className="text-xs font-medium text-muted-foreground">
								门派颜色
							</div>
							<div className="grid grid-cols-5 gap-1.5 sm:grid-cols-7 sm:gap-1">
								{JX3_SCHOOL_PRESETS.map((f) => (
									<button
										key={f.color}
										type="button"
										title={f.label}
										className={`flex h-8 w-8 items-center justify-center rounded-sm border transition-transform hover:scale-110 ${
											color.toLowerCase() === f.color.toLowerCase()
												? "ring-2 ring-ring ring-offset-1"
												: ""
										}`}
										style={{ borderColor: f.color }}
										onClick={() => onChange(f.color)}
									>
										<img
											src={f.icon}
											alt={f.label}
											className="size-5"
											draggable={false}
										/>
									</button>
								))}
							</div>
						</div>
					)}

					<Input
						value={color}
						onChange={(e) => onChange(e.target.value)}
						className="h-9 font-mono text-xs"
						placeholder="#000000"
					/>
				</div>
			</PopoverContent>
		</Popover>
	);

	if (!label) return picker;

	const matchedSchool = showSchoolPresets
		? JX3_SCHOOL_PRESETS.find(
				(s) => s.color.toLowerCase() === color.toLowerCase(),
			)
		: undefined;

	return (
		<div className="flex items-center justify-between">
			<div className="flex items-center gap-1.5">
				<span className="text-xs text-muted-foreground">{label}</span>
				{matchedSchool && (
					<img
						src={matchedSchool.icon}
						alt={matchedSchool.label}
						title={matchedSchool.label}
						className="size-3.5"
						style={{ marginRight: 10 }}
						draggable={false}
					/>
				)}
			</div>
			{picker}
		</div>
	);
}
