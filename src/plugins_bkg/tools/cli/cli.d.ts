
export namespace CLI {
	export type ProcessedArg = {
		flag: string
		data: string | boolean
	}
	export type ProcessedArgs = {
		[key: string]: string | boolean
	}
	export type Argument = {
		description?: string
		has_data?: boolean
	}
}