/**
 * 色值来源：JX3BOX 
 * https://github.com/JX3BOX/jx3box-data/blob/master/data/xf/colors.json
 */

export interface SchoolPreset {
	key: string;
	label: string;
	color: string;
	icon: string;
}

export const JX3_SCHOOL_PRESETS: SchoolPreset[] = [
	{
		key: "tian-ce",
		label: "天策",
		color: "#EC4B2C",
		icon: "/images/icons/天策.png",
	},
	{
		key: "wan-hua",
		label: "万花",
		color: "#BA9BE4",
		icon: "/images/icons/万花.png",
	},
	{
		key: "chun-yang",
		label: "纯阳",
		color: "#37C0E2",
		icon: "/images/icons/纯阳.png",
	},
	{
		key: "qi-xiu",
		label: "七秀",
		color: "#FF7DAD",
		icon: "/images/icons/七秀.png",
	},
	{
		key: "shao-lin",
		label: "少林",
		color: "#E6BC31",
		icon: "/images/icons/少林.png",
	},
	{
		key: "cang-jian",
		label: "藏剑",
		color: "#FDDD70",
		icon: "/images/icons/藏剑.png",
	},
	{
		key: "wu-du",
		label: "五毒",
		color: "#4B9BFB",
		icon: "/images/icons/五毒.png",
	},
	{
		key: "tang-men",
		label: "唐门",
		color: "#90CC50",
		icon: "/images/icons/唐门.png",
	},
	{
		key: "ming-jiao",
		label: "明教",
		color: "#f16040",
		icon: "/images/icons/明教.png",
	},
	{
		key: "gai-bang",
		label: "丐帮",
		color: "#D6A16F",
		icon: "/images/icons/丐帮.png",
	},
	{
		key: "cang-yun",
		label: "苍云",
		color: "#6568ad",
		icon: "/images/icons/苍云.png",
	},
	{
		key: "chang-ge",
		label: "长歌",
		color: "#6DDFE2",
		icon: "/images/icons/长歌.png",
	},
	{
		key: "ba-dao",
		label: "霸刀",
		color: "#8D90D8",
		icon: "/images/icons/霸刀.png",
	},
	{
		key: "peng-lai",
		label: "蓬莱",
		color: "#94C7DC",
		icon: "/images/icons/蓬莱.png",
	},
	{
		key: "ling-xue",
		label: "凌雪",
		color: "#872F37",
		icon: "/images/icons/凌雪.png",
	},
	{
		key: "yan-tian",
		label: "衍天",
		color: "#b9c1ff",
		icon: "/images/icons/衍天.png",
	},
	{
		key: "yao-zong",
		label: "药宗",
		color: "#16708a",
		icon: "/images/icons/药宗.png",
	},
	{
		key: "dao-zong",
		label: "刀宗",
		color: "#6bb7f2",
		icon: "/images/icons/刀宗.png",
	},
	{
		key: "wan-ling",
		label: "万灵",
		color: "#ffde7b",
		icon: "/images/icons/万灵.png",
	},
	{
		key: "duan-shi",
		label: "段氏",
		color: "#96b4cc",
		icon: "/images/icons/段氏.png",
	},
	{
		key: "wu-xiang",
		label: "无相",
		color: "#A18DE3",
		icon: "/images/icons/无相.png",
	},
];

export const COMMON_COLORS = [
	{ label: "白色", color: "#ffffff" },
	{ label: "黑色", color: "#000000" },
	{ label: "红色", color: "#ef4444" },
	{ label: "橙色", color: "#f97316" },
	{ label: "黄色", color: "#eab308" },
	{ label: "绿色", color: "#22c55e" },
	{ label: "青色", color: "#06b6d4" },
	{ label: "蓝色", color: "#3b82f6" },
	{ label: "紫色", color: "#a855f7" },
	{ label: "粉色", color: "#ec4899" },
] as const;
