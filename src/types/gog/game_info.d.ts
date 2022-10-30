export namespace GOG {
	import {ChildProcess} from "child_process";

	export type ImageType = "background" | "logo" | "logo2x" | "icon" |
		"sidebarIcon" | "sidebarIcon2x" | "menuNotificationAv" | "menuNotificationAv2"

	export type PlayTasks = {
			arguments?: string
			workingDir?: string
			category: string
			isPrimary: boolean
			languages: string[]
			name: string
			osBitness?: string[]
			path: string
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

	export type RemoteGameDLC = {
		slug: string
		dl_size: number
		gameId: string
		present: boolean
		download: string[]
		uninstall?: DLCUninstall | string
	}

	export type GamePlatform = "aix" | "darwin" | "freebsd" | "linux" | "openbsd" | "sunos" | "windows" | "deck"

	export type GameSave = Record<string, string>;

	export type GameSavesLocation = Record<GamePlatform, GameSave>

	export type RemoteGameData = {
		logo: string
		folder: string
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
		play_time?: number,
		remote_name: string,
		iter_id: number,
		c_version?: string
	}

	export type ImageResponse = {
		icon: string
		remote: RemoteGameData | undefined
	}
}