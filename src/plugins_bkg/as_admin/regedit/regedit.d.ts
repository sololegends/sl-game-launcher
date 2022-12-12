module "regedit" {
	export namespace Regedit {
		export type Machine = "HKEY_CURRENT_USER" | "HKEY_LOCAL_MACHINE" | "HKEY_CURRENT_CONFIG" | "HKEY_USERS" | "HKEY_CLASSES_ROOT"

		export type RedEditResponse = {
			success: boolean,
			stdout?: string,
			stderr?: string
		}

		export type Type = "REG_SZ" | "REG_MULTI_SZ" | "REG_EXPAND_SZ" | "REG_DWORD" | "REG_QWORD" | "REG_BINARY" | "REG_NONE";

		export type Query = (
			key: string,
			value?: string,
			query_subkeys?: boolean,

			data?: string,
			target?: "key_names" | "data",
			case_sensitive?: boolean,
			exact?: boolean,

			type?: Type,

			separator?: string,
			bit_64?: boolean
		) => Promise<RedEditResponse>

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
}