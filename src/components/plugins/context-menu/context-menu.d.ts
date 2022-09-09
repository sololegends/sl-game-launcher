export namespace ContextMenu {
	export type options = {
		window_bind?: boolean
	}

	export type MenuItem = {
		title: string,
		click: (e: MouseEvent) => void,
		icon?: string
	}

	export type ContextInt = {
		_cont: Vue
		closeAll: () => void
	}

	export type Bind = {
		show: boolean
		x: number
		y: number
	}
}

declare module "vue/types/vue" {
  interface Vue {
    $context_int: ContextMenu.ContextInt
  }
}