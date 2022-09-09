import { DataTableHeader, ItemGroup } from "vuetify/types";

export namespace Vuetify {
	export type Breakpoint = "never" | "xs" | "sm" | "md" | "lg" | "xl" | "inf";
	export interface Column extends DataTableHeader {
		disabled?: boolean
		breakpoint?: Breakpoint
	}
	export interface ColumnBreakpoints {
		[key: string]: Breakpoint
	}

	export interface VForm extends HTMLFormElement {
    validate: () => boolean;
    reset: () => void;
    resetValidation: () => void;
	}

	export interface VDataTable extends HTMLTableElement extends ItemGroup {

	}

	export type Row = {
		expand: (value: boolean) => void,
		headers: DataTableHeader[],
		isExpanded: boolean,
		isMobile: boolean,
		isSelected: boolean,
		item: unknown,
		select: (value: boolean) => void
	}

	export type TableOptions = {
		page: number,
		itemsPerPage: number,
		sortBy: string[],
		sortDesc: boolean[],
		groupBy: string[],
		groupDesc: boolean[],
		multiSort: boolean,
		mustSort: boolean
	}

	export type Rules = {
		required: (value: string | null) => boolean | string
		required_simple: (value: string | null) => boolean | string
		numericMinMax: (min: number, max: number) => ((value: string | null) => boolean | string)
		domain_ip: (value: string) => boolean | string
		domain: (value: string) => boolean | string
		lengthExact: (length: number) => ((value: string | null) => boolean | string)
		lengthMax: (max: number, required?: boolean) => ((value: string | null) => boolean | string)
		lengthMinMax: (min: number, max: number, required?: boolean) => ((value: string | null) => boolean | string)
		required_select_object: (value: object) => boolean | string
		validUsername: (value: string | null) => boolean | string
	}
}



declare module "vue/types/vue" {
  interface Vue {
    $rules: Vuetify.Rules,
    $vuetify_resize: (headers: Vuetify.Column[], ref: Vue | Element | (Vue | Element)[] | undefined) => void,
		$data_table_filter: (value: unknown, search: string, item: unknown) => void
    vuetifyRowDblClick: (e: unknown, i: DataItemProps) => void
  }
}