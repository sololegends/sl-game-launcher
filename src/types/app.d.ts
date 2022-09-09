export namespace App{
	export type ProgressBannerOpts = {
		title: string,
		indeterminate?: boolean,
		cancel_event?: string,
		cancel_data?: unknown,
		color?: string
	}

	export type ProgressBannerProgress = {
		total: number,
		progress: number,
		speed?: number
	}
}