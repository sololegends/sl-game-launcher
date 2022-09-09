
declare module "rate_limit_actions" {
	export namespace RateLimit {
		export type Tracker = {
			[key: string]: number
		}

		export type Options = {
			name: string,
			rate: number,
			delegate: boolean,
			callback: (args: unknown[]) => void
		}
	}
}
