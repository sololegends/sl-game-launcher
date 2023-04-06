
declare module "base_modal_ext"{
	import { SomeArray, SomeMap } from "@/shims-app";
	import {BaseModalN} from "base_modal";
	import { GOG } from "@/types/gog/game_info";
	import { User } from "user";

	export namespace DeleteConfirmN{
		export interface Params extends BaseModalN.Params{
			params:{
				name: string
				message: string
				item: unknown
			}
		}
	}


	export namespace DetailsModalN{
		export interface Params extends BaseModalN.Params{
			params:{
				details: SomeMap | SomeArray
				title: string
				enabled_data: boolean
			}
		}
	}


	export namespace EditUserN{
		export interface Params extends BaseModalN.Params{
			params:{
				user: User.Username
				source: User.Realm
				first_name: string
				last_name: string
				admin_note: string
				roles: User.Role[]
			}
		}

		export type EmitUpdateUser ={
			"user": User.Username,
			"first_name": string,
			"last_name": string,
			"admin_note": string,
			"role": User.Role,
			loading: (loading: boolean) => void
		}
	}

	export namespace MessageModalN{
		export interface Params extends BaseModalN.Params{
			params:{
				item: string
				message: string
				api_output: string
			}
		}
	}


	export namespace PasswordResetN{
		export interface Params extends BaseModalN.Params{
			params:{
				username: string
				message: string
				successful: () => void
			}
		}
	}


	export namespace LaunchOptionsN{
		export interface LaunchOptionsModal extends Vue{
			open: GeneralPopup.LaunchOptionsFn
		}
		export type LaunchOptionsFn = (
			tasks: GOG.PlayTasks[],
			game: GOG.GameInfo,
			force?: boolean,
			primary_only?: boolean
		) => Promise<GOG.PLayTasks>
	}

}