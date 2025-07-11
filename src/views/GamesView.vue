<template>
  <div>
    <DownloadInstallBanner ref="dl_banner" />
    <div style="margin:0px 20px; display: flex;">
      <v-text-field
        v-model="filter" label="Game Search"
        clearable placeholder="Search..." @input="resetSelectedGame"
      />
      <v-select
        label="Game Sorting"
        style="margin-left: 10px; width: 100px"
        v-model="sort_order"
        :items="sortOptions"
        @input="resetSelectedGame"
        @change="saveSortOrder"
      />
      <v-switch v-model="installed_first" label="Installed First" @change="saveInstalledFirst" />
    </div>
    <div
      v-if="filtered_games.length <= 0 && (games.length > 0 || remote_games.length > 0) && !loading_remote_games"
      class="flex h100" style="flex-direction: column;text-align: center;"
    >
      <div class="text-h6">No Games <fa-icon icon="sad-tear" size="lg" /></div>
    </div>
    <div v-else-if="filtered_games.length <= 0" class="flex h100" style="flex-direction: column;text-align: center;">
      <v-progress-circular width="20" size="200" indeterminate style="margin:auto" />
      <div class="text-h6">Loading Games...</div>
    </div>
    <ScrollablePanel :max_height="maxScrollable" @scroll="onScroll" v-else>
      <div class="games-container" id="game_flex" @mouseout="clearSelectedGame">
        <GogGame
          v-for="val, i in sortedGames" :key="val.gameId + '-' + val.root_dir" :game="val"
          class="flex"
          :ref="'game' + i"
          :running="val.name === active"
          :active="active_game === i"
          :data-game="i"
          :game_pos="i"
          :can_install_uninstall="can_install_uninstall"
          @remote="setNewRemote(val, $event)"
          @mouseover="gameMouseOver(i)"
        />
        <GenericCard
          v-if="loading_remote_games"
          name="Loading Remote..."
        />
      </div>
    </ScrollablePanel>
    <DLCSelectionModal :title="can_install_uninstall ? 'Manage DLC' : 'View DLC'" />
    <VersionSelectionModal />
    <SaveSyncStatus />
    <LaunchOptionsModal ref="launch_option_modal" />
    <ChangePasswordModal require_current />
  </div>
</template>

<script lang="ts">
import DownloadInstallBanner, { DIBanner } from "@components/inserts/gog/DownloadInstallBanner.vue";
import GogGame, { GogGameEle } from "../components/inserts/gog/GogGame.vue";
import ChangePasswordModal from "@modals/ChangePasswordModal.vue";
import DLCSelectionModal from "@modals/DLCSelectionModal.vue";
import gamepad from "@mixins/gamepad";
import GenericCard from "../components/inserts/gog/GenericCard.vue";
import { GOG } from "@/types/gog/game_info";
import {ipcRenderer as ipc} from "electron";
import LaunchOptionsModal from "@modals/LaunchOptionsModal.vue";
import { LaunchOptionsN } from "base_modal_ext";
import mixin from "@mixins/index";
import SaveSyncStatus from "@/components/inserts/gog/SaveSyncStatus.vue";
import ScrollablePanel from "@/components/general/ScrollablePanel.vue";
import VersionSelectionModal from "@modals/VersionSelectionModal.vue";

type SortOrder = "ALPHA" | "PLAYTIME" | "RECENT_PLAYED" | "RECENT_ADDED" | "RECENT_UPDATED";

export default mixin(gamepad).extend({
  name: "GamesView",
  components: {
    ChangePasswordModal,
    DLCSelectionModal,
    GenericCard,
    GogGame,
    ScrollablePanel,
    VersionSelectionModal,
    DownloadInstallBanner,
    SaveSyncStatus,
    LaunchOptionsModal
  },
  mixins: [
    gamepad
  ],
  props: {

  },
  data(){
    return {
      games: [] as GOG.GameInfo[],
      remote_games: [] as GOG.GameInfo[],
      loading_remote_games: false,
      force_done_loading: false,
      filtered_games: [] as GOG.GameInfo[],
      active: undefined as undefined | string,
      timer: -1,
      filter: "" as string,
      banner_on: false,
      active_game: -1,
      flex_id: "#game_flex",
      active_class: "active",
      disable_mouse: false,
      disable_mouse_to: -1,
      game_running: false,
      window_blurred: false,
      store_subscription: undefined as (() => void) | undefined,
      select_on_reload: undefined  as string | undefined,
      sort_order: "ALPHA" as SortOrder,
      installed_first: true,
      can_install_uninstall: true
    };
  },
  computed: {
    sortOptions(){
      // Check for offline mode
      if(this.$store.getters.offline){
        if(this.sort_order === "RECENT_ADDED" || this.sort_order === "RECENT_UPDATED"){
          this.sort_order = "ALPHA";
        }
        return [
          { text: "Alphabetic", value: "ALPHA" },
          { text: "Recently Played", value: "RECENT_PLAYED" },
          { text: "Playtime", value: "PLAYTIME" }
        ];
      }
      return [
        { text: "Alphabetic", value: "ALPHA" },
        { text: "Recently Played", value: "RECENT_PLAYED" },
        { text: "Playtime", value: "PLAYTIME" },
        { text: "Recently Added", value: "RECENT_ADDED" },
        { text: "Recently Updated", value: "RECENT_UPDATED" }
      ];
    },
    maxScrollable(): string{
      return this.banner_on ? "calc(100vh - 160px)" : "calc(100vh - 130px)";
    },
    sortedGames(): GOG.GameInfo[]{
      switch(this.sort_order){
      case "ALPHA":
        return this.filtered_games.sort((a: GOG.GameInfo, b: GOG.GameInfo) => {
          if(this.installed_first){
            const res = (b.is_installed ? 1 : 0) - (a.is_installed ? 1 : 0);
            if(res !== 0){
              return res;
            }
          }
          return a.name.localeCompare(b.name);
        });
      case "RECENT_PLAYED":
        return this.filtered_games.sort((a: GOG.GameInfo, b: GOG.GameInfo) => {
          if(this.installed_first){
            const res = (b.is_installed ? 1 : 0) - (a.is_installed ? 1 : 0);
            if(res !== 0){
              return res;
            }
          }
          if((a.last_played === undefined  && b.last_played === undefined)
                    || (a.last_played === 0  && b.last_played === 0)){
            return a.name.localeCompare(b.name);
          }
          return (b.last_played === undefined ? 0 : b.last_played) - (a.last_played === undefined ? 0 : a.last_played);
        });
      case "PLAYTIME":
        return this.filtered_games.sort((a: GOG.GameInfo, b: GOG.GameInfo) => {
          if(this.installed_first){
            const res = (b.is_installed ? 1 : 0) - (a.is_installed ? 1 : 0);
            if(res !== 0){
              return res;
            }
          }
          if((a.play_time === undefined  && b.play_time === undefined)
                    || (a.play_time === 0  && b.play_time === 0)){
            return a.name.localeCompare(b.name);
          }
          return (b.play_time === undefined ? 0 : b.play_time) - (a.play_time === undefined ? 0 : a.play_time);
        });
      case "RECENT_UPDATED":
        return this.filtered_games.sort((a: GOG.GameInfo, b: GOG.GameInfo) => {
          if(this.installed_first){
            const res = (b.is_installed ? 1 : 0) - (a.is_installed ? 1 : 0);
            if(res !== 0){
              return res;
            }
          }
          if((a.remote?.last_updated === undefined  && b.remote?.last_updated === undefined)
                    || (a.remote?.last_updated === 0  && b.remote?.last_updated === 0)){
            return a.name.localeCompare(b.name);
          }
          return (b.remote?.last_updated === undefined ? 0 : b.remote?.last_updated)
                  - (a.remote?.last_updated === undefined ? 0 : a.remote?.last_updated);
        });
      case "RECENT_ADDED":
        return this.filtered_games.sort((a: GOG.GameInfo, b: GOG.GameInfo) => {
          if(this.installed_first){
            const res = (b.is_installed ? 1 : 0) - (a.is_installed ? 1 : 0);
            if(res !== 0){
              return res;
            }
          }
          if((a.remote?.date_added === undefined  && b.remote?.date_added === undefined)
                    || (a.remote?.date_added === 0  && b.remote?.date_added === 0)){
            return a.name.localeCompare(b.name);
          }
          return (b.remote?.date_added === undefined ? 0 : b.remote?.date_added)
                  - (a.remote?.date_added === undefined ? 0 : a.remote?.date_added);
        });
      default:
        return this.filtered_games;
      }
    }
  },
  updated(){
    if(this.select_on_reload && this.selectGame(this.select_on_reload, "remote_name", false)){
      this.select_on_reload = undefined;
    }
  },
  mounted(){
    window.launch_option_modal = this.$refs.launch_option_modal as LaunchOptionsN.LaunchOptionsModal;
    this.$store.dispatch("set_minimal_ui", false);
    this.$store.dispatch("set_light_ui", false);
    this.store_subscription = this.$store.subscribe((mutation) => {
      if(mutation.type === "set_show_repacked_only"
        || mutation.type === "set_show_uninstalled"
        || mutation.type === "set_show_hidden_games"){
        this.filterGames();
      }
    });

    ipc.invoke("install-allowed").then((ins_allowed: boolean) => {
      this.can_install_uninstall = ins_allowed;
    });

    ipc.invoke("cfg-get", "sort_order").then((sort_order) => {
      this.sort_order = sort_order;
    });
    ipc.invoke("cfg-get", "installed_first").then((installed_first) => {
      this.installed_first = installed_first;
    });

    const that = this;
    ipc.on("progress-banner-init", () => {
      this.banner_on = true;
    });
    ipc.on("progress-banner-hide", () => {
      this.banner_on = false;
    });
    ipc.on("win-blur", () => {
      this.window_blurred = true;
    });
    ipc.on("win-focus", () => {
      this.window_blurred = false;
    });
    ipc.on("game-running-changed", (e, info: GOG.GameInfo) => {
      this.game_running = info !== undefined;
    });
    ipc.on("gog-path-change", () => {
      that.updateGames();
    });
    ipc.on("gog-game-reload", async() => {
      await that.updateGames();
    });
    ipc.on("game-running-changed", (e, game: GOG.GameInfo) => {
      this.active = undefined;
      if(game !== undefined){
        this.active = game.name;
      }
    });

    ipc.on("game-playtime-update", (e, game: GOG.GameInfo, playtime: number) => {
      for(const g of this.games){
        if(g.name === game.name){
          g.play_time = playtime;
          break;
        }
      }
    });

    ipc.on("game-last-played-update", (e, game: GOG.GameInfo, last_played: number) => {
      for(const g of this.games){
        if(g.name === game.name){
          g.last_played = last_played;
          break;
        }
      }
    });

    ipc.on("game-hidden-update", (e, game: GOG.GameInfo, hidden: boolean) => {
      for(const g of this.games){
        if(g.name === game.name){
          g.is_hidden = hidden;
          break;
        }
      }
      for(const g of this.remote_games){
        if(g.name === game.name){
          g.is_hidden = hidden;
          break;
        }
      }
      this.filterGames();
    });

    ipc.on("launch-game-from-url",  async(e, game_id: string) => {
      while(this.games.length <= 0){
        console.log("Awaiting games:", this.games.length);
        await this.sleep(1000);
      }
      let game = undefined;
      for(const ele of this.games){
        if(game_id === ele.gameId){
          game = ele;
          break;
        }
      }
      console.log("Attempting to launch game:", game);
      if(game){
        this.launchGame(game);
      }
    });

    this.awaitLoad();

    ipc.on("game-dl-end", (e, game: GOG.GameInfo, finished, title?: string) => {
      if(finished){
        this.$notify({
          type: "success",
          title: "Download Complete!",
          text: title || game.name
        });
        return;
      }
      this.$notify({
        type: "info",
        title: "Download canceled",
        text: title || game.name
      });
    });
    ipc.on("game-dlins-end", async(e, game: GOG.GameInfo) => {
      // Select the game
      this.select_on_reload = game.remote_name;
    });
    ipc.on("game-ins-end", async(e, game: GOG.GameInfo, success: boolean, title?: string) => {
      if(success){
        this.$notify({
          type: "success",
          title: "Install Complete!",
          text: title || game.name
        });
        return;
      }
      this.$notify({
        type: "warning",
        title: "Install canceled",
        text: title || game.name
      });
    });
    ipc.on("game-uns-end", (e, game: GOG.GameInfo, title?: string) => {
      this.$notify({
        type: "success",
        title: "Uninstall Complete!",
        text: title || game.name
      });
    });

    ipc.on("game-remote-updated", (e, game: GOG.GameInfo, remote: GOG.RemoteGameData) => {
      // Find the game to update it
      for(const g in this.games){
        if(game.gameId === this.games[g].gameId){
          this.games[g].remote = remote;
        }
      }
      this.filterGames();
    });

    // ! TEST CODE
    window.addEventListener("keydown", this.keyHandler);

    this.registerControllerHandlers();
  },
  beforeDestroy(){
    if(this.store_subscription){
      this.store_subscription();
    }
    window.removeEventListener("keydown", this.keyHandler);
  },
  methods: {
    saveSortOrder(){
      ipc.send("cfg-set", "sort_order", this.sort_order);
    },
    saveInstalledFirst(){
      ipc.send("cfg-set", "installed_first", this.installed_first);
    },
    async awaitLoad(){
      while(this.games.length <= 0 && !this.force_done_loading){
        console.log("Awaiting load: calling read-games");
        const games = await this.updateGames();
        if(games.length > 0){
          break;
        }
        console.log("Await start sleeping...");
        await this.sleep(5000);
      }
    },
    enableMouseTO(){
      if(this.disable_mouse_to !== -1){
        clearTimeout(this.disable_mouse_to);
      }
      this.disable_mouse_to = setTimeout(() => { this.disable_mouse = false; }, 1000) as unknown as number;
    },
    registerControllerHandlers(): void{
      this.$g_on([ "d_up", "ls_up" ], () => {
        if(this.game_running || this.window_blurred){ return; }
        this.disable_mouse = true;
        this.navigateGrid("ArrowUp");
        this.enableMouseTO();
      });
      this.$g_on([ "d_down", "ls_down" ], () => {
        if(this.game_running || this.window_blurred){ return; }
        this.disable_mouse = true;
        this.navigateGrid("ArrowDown");
        this.enableMouseTO();
      });
      this.$g_on([ "d_right", "ls_right" ], () => {
        if(this.game_running || this.window_blurred){ return; }
        this.disable_mouse = true;
        this.navigateGrid("ArrowRight");
        this.enableMouseTO();
      });
      this.$g_on([ "d_left", "ls_left" ], () => {
        this.disable_mouse = true;
        if(this.game_running || this.window_blurred){ return; }
        this.navigateGrid("ArrowLeft");
        this.enableMouseTO();
      });
      this.$g_on("a", () => {
        if(this.game_running || this.window_blurred){ return; }
        this.triggerGameAction();
      });
      this.$g_on("b", () => {
        if(this.game_running || this.window_blurred){ return; }
        const banner = this.$refs.dl_banner as DIBanner;
        if(banner){
          banner.cancel();
        }
      });
      this.$g_on("gamepadconnected", () => {
        this.resetSelectedGame();
      });
      this.$g_on("gamepaddisconnected", () => {
        this.clearSelectedGame();
      });
    },
    gameMouseOver(game_id: number){
      if(this.disable_mouse){
        return;
      }
      this.navigateGrid(game_id);
    },
    clearSelectedGame(){
      if(this.active_game === -1){
        return;
      }
      this.active_game = -1;
      this.navigateGrid("NONE");
    },
    resetSelectedGame(){
      this.active_game = 0;
      this.navigateGrid("RESET");
      this.filterGames();
    },
    keyHandler(e: KeyboardEvent){
      switch(e?.key){
      case "ArrowUp": case "ArrowDown": case "ArrowLeft": case "ArrowRight":
        this.disable_mouse = true;
        e.preventDefault();
        this.navigateGrid(e.key);
        this.enableMouseTO();
        break;
      case "Enter":
        e.preventDefault();
        this.triggerGameAction();
        break;
      default:
        break;
      }
    },
    setNewRemote(game: GOG.GameInfo, remote: GOG.RemoteGameData){
      const different = game.remote !== remote;
      this.$set(game, "remote", remote);
      if(different){
        this.filterGames();
      }
    },
    isRepacked(game: GOG.GameInfo): boolean | undefined{
      if(game.remote?.download && game.remote?.download.length > 0){
        return game.remote?.download[0].includes(".zip");
      }
      return false;
    },

    filterGames(): void{
      const is_filtered = this.filter != null && this.filter.trim() !== "";
      const installed_only = is_filtered && this.filter.startsWith("installed:");
      const uninstalled_only = is_filtered && this.filter.startsWith("uninstalled:");
      const actual_filter = installed_only ? this.filter.substring(10) : (uninstalled_only ? this.filter?.substring(12) : this.filter);
      let games = [];
      if(this.$store.getters.showUninstalled && !installed_only){
        games = [ ...this.games, ...this.remote_games ];
      } else if(uninstalled_only){
        games = [...this.remote_games];
      } else {
        games = [...this.games];
      }
      this.filtered_games = games.filter((game) => {
        // If not repacked and set to repacked only
        // If not remote always pass
        if(game.webcache === "remote"
          && this.$store.getters.showRepackedOnly && !this.isRepacked(game)){
          return false;
        }
        if(!this.$store.getters.showHiddenGames && game.is_hidden){
          return false;
        }
        // If the filter is populated
        if(actual_filter != null && actual_filter.trim() !== ""){
          return game.name.toLowerCase().includes(actual_filter.trim().toLowerCase());
        }
        return true;
      });
    },
    onScroll(){
      this.$context_int.closeAll();
    },
    async updateGames(){
      return new Promise<GOG.GameInfo[]>((resolve, reject) => {
        console.log("invoking read-games");
        ipc.invoke("read-games", true).then(async(res: GOG.GameInfo[]) => {
          this.games = res;
          if(this.games.length > 0){
            // Run the update check
            ipc.send("check-for-updates", this.games, false);
            this.filterGames();
            resolve(this.games);
            if(this.loading_remote_games === false){
              this.loading_remote_games = true;
              console.log("invoking read-remote-games");
              ipc.invoke("read-remote-games").then((remote_games: GOG.GameInfo[]) => {
                this.loading_remote_games = false;
                this.remote_games = remote_games;
                this.filterGames();
                this.force_done_loading = true;
              });
            }
            return;
          }else{
            resolve([]);
            if(this.loading_remote_games === false){
              this.loading_remote_games = true;
              console.log("invoking read-remote-games");
              ipc.invoke("read-remote-games").then((remote_games: GOG.GameInfo[]) => {
                this.loading_remote_games = false;
                this.remote_games = remote_games;
                this.filterGames();
                this.force_done_loading = true;
              });
            }
          }
          reject(this.games);
        });
      });
    },
    launchGame(game: GOG.GameInfo){
      for(const g in this.$refs){
        const ele_t = this.$refs[g] as GogGameEle | GogGameEle[];
        const ele = Array.isArray(ele_t) ? ele_t[0] : ele_t;
        const gd = ele.gameData;
        if(!gd){
          continue;
        }
        if(gd && gd.gameId === game.gameId && !ele.isRemote){
          ele.launchGame();
        }
      }
    },
    selectGame(game_id: string, selection: keyof GOG.GameInfo, all = true): boolean{
      for(const g in this.$refs){
        const ele_t = this.$refs[g] as GogGameEle | GogGameEle[];
        const ele = Array.isArray(ele_t) ? ele_t[0] : ele_t;
        if(!ele){
          continue;
        }
        const gd = ele.gameData;
        if(!gd){
          continue;
        }
        if(gd && gd[selection] === game_id && (all || !ele.isRemote)){
          console.log("Navigating to pos: ", ele.gamePos);
          this.disable_mouse = true;
          this.navigateGrid(ele.gamePos);
          this.enableMouseTO();
          return true;
        }
      }
      return false;
    },
    triggerGameAction(){
      if(this.active_game === -1){
        return;
      }
      // Get active game
      let game = this.$refs["game" + this.active_game] as GogGameEle | GogGameEle[];
      if(Array.isArray(game)){
        game = game[0];
      }
      if(game){
        console.log(game);
        if(game.isRemote){
          game.downloadAndInstall();
          return;
        }
        if(!game.isRunning){
          game.launchGame();
        }
      }
    },
    navigateGrid: function(direction_id: string | number, flexbox_grid?: string){
      if(!flexbox_grid){
        flexbox_grid = this.flex_id;
      }
      const grid = document.querySelector(flexbox_grid);
      if(grid === null){
        console.log("Failed to find element with selector: [" + flexbox_grid + "]");
        return;
      }

      const updateActiveItem = (next: HTMLElement | null) => {
        if(next){
          const br = next.getBoundingClientRect();
          if(this.disable_mouse && br.y >= window.innerHeight - br.height || br.y < br.height){
            next.scrollIntoView({behavior: "smooth", block: "nearest"});
          }
          this.active_game = parseInt(next.getAttribute("data-game") || "-1");
        }else{
          this.active_game = -1;
        }
      };
      const active = grid.querySelector(`.${this.active_class}`) as HTMLElement;
      if(active === null){
        updateActiveItem(null);
      }
      const grid_children = Array.from(grid.children) as HTMLElement[];
      const activeIndex = this.active_game;
      const grid_num = grid_children.length;
      if(grid_num === 0){
        return;
      }
      const base_offset = grid_children[0].offsetTop;
      const break_index = grid_children.findIndex(item => item.offsetTop > base_offset);
      const num_per_row = (break_index === -1 ? grid_num : break_index);

      const is_top_row = activeIndex <= num_per_row - 1;
      const is_bottom_row = activeIndex >= grid_num - num_per_row;
      const is_left_col = activeIndex % num_per_row === 0;
      const is_right_col = activeIndex % num_per_row === num_per_row - 1 || activeIndex === grid_num - 1;

      if(typeof direction_id !== "string"){
        updateActiveItem(grid_children[direction_id]);
        return;
      }
      switch (direction_id){
      case "ArrowUp":
        if (!is_top_row){
          updateActiveItem(grid_children[activeIndex - num_per_row]);
        }
        break;
      case "ArrowDown":
        if (!is_bottom_row){
          updateActiveItem(grid_children[activeIndex + num_per_row]);
        }
        break;
      case "ArrowLeft":
        if (!is_left_col){
          updateActiveItem(grid_children[activeIndex - 1]);
        }
        break;
      case "ArrowRight":
        if (!is_right_col){
          updateActiveItem(grid_children[activeIndex + 1]);
        }
        break;
      case "RESET":
        updateActiveItem(grid_children[0]);
        break;
      case "NONE":
        updateActiveItem(null);
        break;
      default: break;
      }
    }
  }
});
</script>

<style scoped>

.games-container{
	padding: 10px;
	width: calc(100vw - 22px);
	height: calc(100vh - 55px);
	display: flex;
	flex-wrap:wrap;
	align-content: flex-start;
	align-items: flex-start;
	flex-grow: 0;
}
</style>