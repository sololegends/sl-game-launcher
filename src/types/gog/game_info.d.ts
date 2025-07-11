

export namespace GOG {

	import {ChildProcess} from "child_process";
	import { Machine } from "regedit";

	export type ImageType = "background" | "logo" | "logo2x" | "icon" |
		"sidebarIcon" | "sidebarIcon2x" | "menuNotificationAv" | "menuNotificationAv2"

	export type PlayTasks = {
			arguments?: string | string[]
			workingDir?: string
			category: string
			isPrimary: boolean
			languages: string[]
			name?: string
			osBitness?: string[]
			path?: string
			link?: string
			type: string
	}

	export type RunningGame = {
		process?: ChildProcess
		info: GOG.GameInfo
	}

	export type WebDavConfig = {
		url: string
		user: string
		pass: string
		folder: string
	}

	export type DLCUninstall = {
		files: string[]
		folders: string[]
	}

	export type GameRedist = {
		exe_path: string
		arguments: string[]
		name?: string
		version?: string
	}

	export interface RemoteGameDLCBuilding {
		slug: string
		dl_size: number
		gameId: string
		version?: string
		iter_id?: number
		download: string[]
		install_size?: number
		uninstall?: DLCUninstall | string
		redist?: GameRedist[]
	}

	export interface RemoteGameDLC extends RemoteGameDLCBuilding {
		present: boolean
		playTasks?: PlayTasks[]
	}

	export type GamePlatform = "aix" | "darwin" | "freebsd" | "linux" | "openbsd" | "sunos" | "windows" | "deck"

	export type GameSave = Record<string, string>;

	export type GameSavesLocation = Record<GamePlatform, GameSave>

	export type UninstallDef = {
		files: string[]
		folders: string[]
	}

	export type RemoteGameData = {
		logo: string
		folder?: string
		name?: string
		game_id: string
		logo_format: string
		slug: string
		download: string[]
		dl_size: number
		install_size?: number
		dlc: RemoteGameDLC[]
		versions?: Record<string, RemoteGameDLC>
		is_zip?: boolean
		saves?: GameSavesLocation
		version?: string
		iter_id?: number
		redist?: GameRedist[]
		last_updated?: number
		date_added?: number
	}

	export type GameInfo = {
		buildId?: string
		clientId: string
		gameId: string
		language: string
		languages: string[]
		name: string
		osBitness?: string[]
		playTasks: PlayTasks[]
		rootGameId: string
		version: number
		webcache: string
		root_dir: string
		install_size?: number
		remote?: RemoteGameData
		current_version?: string
		play_time?: number
		last_played?: number
		remote_name: string
		iter_id: number
		c_version?: string
		is_installed: boolean
		is_hidden: boolean
	}

	export type ImageResponse = {
		icon: string
		remote: RemoteGameData | undefined
	}

	export namespace ScriptInstall {
		export interface savePath {
			action: "savePath"
			no_uninstall: boolean
			arguments: {
				savePath: string
				type: "folder" | "file"
			}
		}

		export interface ensureDirectory {
			action: "ensureDirectory"
			no_uninstall: boolean
			arguments: {
				target: string
			}
		}

		export interface supportData {
			action: "supportData"
			no_uninstall: boolean
			arguments: {
				// Mutate ONLY for file types
				mutate?: boolean
				overwrite: boolean
				source: string
				target: string
				type: "folder" | "file" | "archive"
			}
		}

		export interface setRegistry {
			action: "setRegistry"
			no_uninstall: boolean
			arguments: {
				root: Machine
				subkey: string
				valueData: string
				valueName: string
				valueType: string
				deleteSubkeys: boolean
			}
		}

		export interface xmlData {
			action: "xmlData"
			no_uninstall: boolean
			arguments: {
				target: string
				type: "insert" | "delete"
				path: string
				id?: string
				data: Record<string, string>
			}
		}
	}

	export type ScriptInstallAction =
		ScriptInstall.savePath
		| ScriptInstall.setRegistry
		| ScriptInstall.supportData
		| ScriptInstall.xmlData
		| ScriptInstall.ensureDirectory

	export type ScriptAction = {
		install: ScriptInstallAction
		languages: string[]
		name: string
	}

	export type Script = {
		actions: ScriptAction[]
	}
}