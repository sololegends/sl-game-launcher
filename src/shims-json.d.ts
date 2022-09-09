
export interface MenuItem {
	name: string;
	icon?: string;
	icon_src?: string;
	icon_alt?: string
	title: string;
	short_title?: string;
	enabled: boolean;
	role: "GUEST" | "AUDITOR" | "USER" | "ADMIN" | "OWNER";
	minimal_ui?: boolean;
}

type MenuItems = {
	[key: string]: MenuItem
};