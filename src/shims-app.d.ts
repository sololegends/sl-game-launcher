
import {DynamicBoolean, DynamicString} from "@jsplugins/dynamic_property";
import { BaseModalN } from "base_modal";

export type APPFunctions = {
	save: (text: string, element: HTMLElement | string, data_type?: string) => void,
	copyText: (text: string, element?: HTMLElement | string) => boolean;
}

export type AppProperties = {
	company: string
	app: string
}

export type IndeterminateNumber = number | "-";

export namespace ActionsMenu {
  export type ActionItem = {
		action: () => void;
		title: string;
		text?: DynamicString;
		icon: DynamicString;
		disabled?: DynamicBoolean;
		hidden?: DynamicBoolean;
		color?: string;
  };
}

export namespace StatsCard {
	export type Threshold = {
		min: number,
		max: number,
		color: string
	}
}

export namespace VueE{
  export type ClassObject = {
    [key: string]: boolean
  }
}

export type SomeMap = {
  [key: string]: unknown
}
export type SomeArray = unknown[]


declare module "vue/types/vue" {
  interface Vue {
    $hash: () => string,
		$api_root: string,
    $modal: BaseModalN.Modal
    $fn: APPFunctions,
    $user: UserFunctions,
		$isAuditor: () => boolean
		$isUser: () => boolean
		$isAdmin: () => boolean
		$isOwner: () => boolean
		$properties: AppProperties
  }
}