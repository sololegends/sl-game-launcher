import Vue from "vue";

export namespace Notify {
	export type Type = "error" | "warning" | "success" | "info";

	export type Alert = {
		id?: number;
		title: string;
		text?: string;
		loading?: boolean;
		sticky?: boolean;
		duration?: number;
		timestamp?: string;
		type: Notify.Type;
		closed?: (alert: Notify.Alert) => void | Promise;
	};

	export interface AlertInternal extends Alert{
		id: number;
		show?: boolean;
		hover?: boolean;
		timer: number;
		interval: number;
		clear: () => void;
	}

	export type PluginOptions = {
		window_bind?: boolean
	};

	export type Data = {
		_cont: Vue;
		_id: number;
		getId: () => string;
	};

	export type Position = {
		top?: number
		right?: number
		bottom?: number
		left?: number
	}
}

declare module "vue/types/vue" {
  interface Vue {
    $notify: (params: Notify.Alert, group?: string) => string,
		$notify_data: Notify.Data,
		$notifyClear: (id: number) => void
  }
}