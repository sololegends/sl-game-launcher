<template>
  <div>
    <DownloadInstallBanner ref="dl_banner" />
    <div style="margin:0px 20px">
      <v-text-field v-model="filter" clearable placeholder="Search..." @input="resetSelectedGame" />
    </div>
    <div v-if="filtered_games.length <= 0" class="flex h100" style="flex-direction: column;text-align: center;">
      <v-progress-circular width="20" size="200" indeterminate style="margin:auto" />
      <div class="text-h6">Loading Games...</div>
    </div>
    <ScrollablePanel :max_height="maxScrollable" @scroll="onScroll" v-else>
      <div class="games-container" id="game_flex">
        <GogGame
          v-for="val, i in filtered_games" :key="val.gameId" :game="val"
          class="flex"
          :ref="'game' + i"
          :running="val.name === active"
          :active="active_game === i"
          :data-game="i"
          @remote="setNewRemote(val, $event)"
          @mouseover="gameMouseOver(i)"
        />
        <GenericCard
          v-if="remote_games.length <= 0"
          name="Loading Remote..."
        />
      </div>
    </ScrollablePanel>
    <DLCSelectionModal />
    <VersionSelectionModal />
    <SaveSyncStatus />
  </div>
</template>

<script lang="ts">
import DownloadInstallBanner, { DIBanner } from "@components/inserts/gog/DownloadInstallBanner.vue";
import GogGame, { GogGameEle } from "../components/inserts/gog/GogGame.vue";
import DLCSelectionModal from "@modals/DLCSelectionModal.vue";
import gamepad from "@mixins/gamepad";
import GenericCard from "../components/inserts/gog/GenericCard.vue";
import { GOG } from "@/types/gog/game_info";
import {ipcRenderer as ipc} from "electron";
import mixin from "@mixins/index";
import SaveSyncStatus from "@/components/inserts/gog/SaveSyncStatus.vue";
import ScrollablePanel from "@/components/general/ScrollablePanel.vue";
import VersionSelectionModal from "@modals/VersionSelectionModal.vue";


export default mixin(gamepad).extend({
  name: "GamesView",
  components: {
    DLCSelectionModal,
    GenericCard,
    GogGame,
    ScrollablePanel,
    VersionSelectionModal,
    DownloadInstallBanner,
    SaveSyncStatus
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
      filtered_games: [] as GOG.GameInfo[],
      active: undefined as undefined | string,
      timer: -1,
      filter: null as null | string,
      banner_on: false,
      active_game: -1,
      flex_id: "#game_flex",
      active_class: "active",
      disable_mouse: false,
      disable_mouse_to: -1,
      game_running: false,
      window_blurred: false,
      store_subscription: undefined as (() => void) | undefined
    };
  },
  computed: {
    maxScrollable(): string{
      return this.banner_on ? "calc(100vh - 160px)" : "calc(100vh - 130px)";
    }
  },
  mounted(){
    this.store_subscription = this.$store.subscribe((mutation) => {
      if(mutation.type === "set_show_repacked_only" || mutation.type === "set_show_uninstalled"){
        this.filterGames();
      }
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
    ipc.on("gog-game-reload", () => {
      that.updateGames();
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
        }
      }
    });

    ipc.on("launch-game-from-url",  async(e, game_id: string) => {
      while(this.games.length <= 0){
        console.log("Awaiting games:", this.games.length);
        await this.sleep(1000);
      }
      let game = undefined;
      for(const ele of this.games){
        if(game_id === ele.gameId || game_id === ele.remote_name){
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

    ipc.on("game-ins-end", (e, game: GOG.GameInfo, success: boolean, title?: string) => {
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
    async awaitLoad(){
      while(this.games.length <= 0){
        console.log("Awaiting load: calling read-games");
        const games = await this.updateGames();
        console.log("Games read attempt: ", games);
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
      this.disable_mouse_to = setTimeout(() => { this.disable_mouse = false; }, 500) as unknown as number;
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
        this.navigateGrid("ArrowRight");
      });
      this.$g_on([ "d_left", "ls_left" ], () => {
        if(this.game_running || this.window_blurred){ return; }
        this.navigateGrid("ArrowLeft");
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
      switch(e.key){
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
      const is_filtered = this.filter !== null && this.filter.trim() !== "";
      const installed_only = is_filtered && this.filter?.startsWith("installed:");
      const uninstalled_only = is_filtered && this.filter?.startsWith("uninstalled:");
      const actual_filter = installed_only ? this.filter?.substring(10) : (uninstalled_only ? this.filter?.substring(12) : this.filter);
      let games = [...this.games];
      if(this.$store.getters.showUninstalled && !installed_only){
        games = [ ...this.games, ...this.remote_games ];
      }
      if(uninstalled_only){
        games = [...this.remote_games];
      }
      this.filtered_games = games.filter((game) => {
        // If not repacked and set to repacked only
        // If not remote always pass
        if(game.webcache === "remote"
          && this.$store.getters.showRepackedOnly && !this.isRepacked(game)){
          return false;
        }
        // If the filter is populated
        if(actual_filter && actual_filter.trim() !== ""){
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
        ipc.invoke("read-games", true).then(async(res: GOG.GameInfo[]) => {
          this.games = res;
          if(this.games.length > 0){
            resolve(this.games);
            // Run the update check
            ipc.send("check-for-updates", this.games);
            this.filterGames();
            ipc.invoke("read-remote-games").then((remote_games: GOG.GameInfo[]) => {
              this.remote_games = remote_games;
              this.filterGames();
            });
            return;
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
          if(br.y >= window.innerHeight - br.height || br.y < br.height){
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