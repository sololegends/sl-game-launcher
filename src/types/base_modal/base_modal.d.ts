declare module "base_modal"{
	export namespace BaseModalN{
		export type ActionItem = {
			action: (item: ActionItem, e: Event) => void;
			text: string | (() => string);
			name?: string | (() => string);
			loading?: boolean | (() => boolean);
			disabled?: boolean | (() => boolean);
			enabled?: boolean | (() => boolean);
			color?: string;
		};
		export interface Params {
			params:{
				[key: string]: unknown
			}
		}
		export type Modal = {
			_cont: Vue
			show: (id: string, params?: unknown) => void
			hide: (id: string, params?: unknown) => void
		};
	}
}