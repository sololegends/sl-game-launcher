module "regedit" {

	export type RedEditResponse = {
		success: boolean,
		stdout?: string,
		stderr?: string
	}

	export type Type = "REG_SZ" | "REG_MULTI_SZ" | "REG_EXPAND_SZ" | "REG_DWORD" | "REG_QWORD" | "REG_BINARY" | "REG_NONE";

	export type Add = (
		key: string,
		value?: string,
		type?: Type,
		data?: string,
		separator?: string,
		force?: boolean,
		bit_64?: boolean
	) => Promise<RedEditResponse>


}