<template>
  <div>
    <DownloadInstallBanner ref="dl_banner" />
    <div style="margin:0px 20px">
      <v-text-field v-model="filter" clearable placeholder="Search..." @input="resetSelectedGame" />
    </div>
    <ScrollablePanel :max_height="maxScrollable" @scroll="onScroll">
      <div class="games-container" id="game_flex">
        <GogGame
          v-for="val, i in gamesFiltered" :key="i" :game="val"
          class="flex"
          :ref="'game' + i"
          :running="val.name === active"
          :active="active_game === i"
          :data-game="i"
          @remote="setNewRemote(val, $event)"
          @mouseover="gameMouseOver(i)"
        />
      </div>
    </ScrollablePanel>
    <DLCSelectionModal />
    <VersionSelectionModal />
  </div>
</template>

<script lang="ts">
import DownloadInstallBanner, { DIBanner } from "@components/inserts/gog/DownloadInstallBanner.vue";
import GogGame, { GogGameEle } from "../components/inserts/gog/GogGame.vue";
import DLCSelectionModal from "@modals/DLCSelectionModal.vue";
import gamepad from "@mixins/gamepad";
import { GOG } from "@/types/gog/game_info";
import {ipcRenderer as ipc} from "electron";
import mixin from "@mixins/index";
import ScrollablePanel from "@/components/general/ScrollablePanel.vue";
import VersionSelectionModal from "@modals/VersionSelectionModal.vue";


export default mixin(gamepad).extend({
  name: "GamesView",
  components: {
    DLCSelectionModal,
    GogGame,
    ScrollablePanel,
    VersionSelectionModal,
    DownloadInstallBanner
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
      window_blurred: false
    };
  },
  computed: {
    maxScrollable(): string{
      return this.banner_on ? "calc(100vh - 160px)" : "calc(100vh - 130px)";
    },
    gamesFiltered(): GOG.GameInfo[]{
      if(this.filter === null || this.filter.trim() === ""){
        return [ ...this.games, ...this.remote_games ];
      }
      let actual_f = this.filter;
      let installed = true;
      let remote = true;
      if(this.filter.startsWith("installed:")){
        remote = false;
        actual_f = this.filter.substring(10);
      }
      if(this.filter.startsWith("remote:")){
        installed = false;
        actual_f = this.filter.substring(7);
      }
      const filtered = [] as GOG.GameInfo[];
      if(installed){
        for(const i in this.games){
          if(this.games[i].name.toLowerCase().includes(actual_f.trim())){
            filtered.push(this.games[i]);
          }
        }
      }
      if(remote){
        for(const i in this.remote_games){
          if(this.remote_games[i].name.toLowerCase().includes(actual_f.trim())){
            filtered.push(this.remote_games[i]);
          }
        }
      }
      return filtered;
    }
  },
  mounted(){
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

    this.timer = setInterval(() =>{
      if(this.games.length > 0){
        clearInterval(this.timer);
        return;
      }
      this.updateGames();
    }, 1000) as unknown as number;

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

    // ! TEST CODE
    window.addEventListener("keydown", this.keyHandler);

    this.registerControllerHandlers();
  },
  beforeDestroy(){
    window.removeEventListener("keydown", this.keyHandler);
  },
  methods: {
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
      console.log("HELL O THERE");
      if(this.active_game === -1){
        return;
      }
      this.active_game = -1;
      this.navigateGrid("NONE");
    },
    resetSelectedGame(){
      this.active_game = 0;
      this.navigateGrid("RESET");
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
      this.$set(game, "remote", remote);
    },
    onScroll(){
      this.$context_int.closeAll();
    },
    updateGames(): void{
      ipc.invoke("read-games", true).then((res: GOG.GameInfo[]) => {
        this.games = res;
        ipc.invoke("read-remote-games").then((remote_games: GOG.GameInfo[]) => {
          this.remote_games = remote_games;
        });
      });
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
      console.log("activeIndex", activeIndex);
      console.log("num_per_row", num_per_row);
      console.log("grid_num", grid_num);
      console.log("direction_id", direction_id);


      const is_top_row = activeIndex <= num_per_row - 1;
      const is_bottom_row = activeIndex >= grid_num - num_per_row;
      const is_left_col = activeIndex % num_per_row === 0;
      const is_right_col = activeIndex % num_per_row === num_per_row - 1 || activeIndex === grid_num - 1;

      console.log(is_top_row, is_bottom_row, is_left_col, is_right_col);
      if(typeof direction_id !== "string"){
        // This.active_game = direction_id;
        updateActiveItem(grid_children[direction_id]);
        return;
      }
      switch (direction_id){
      case "ArrowUp":
        if (!is_top_row){
          // This.active_game = activeIndex - num_per_row;
          updateActiveItem(grid_children[activeIndex - num_per_row]);
        }
        break;
      case "ArrowDown":
        if (!is_bottom_row){
          // This.active_game = activeIndex + num_per_row;
          updateActiveItem(grid_children[activeIndex + num_per_row]);
        }
        break;
      case "ArrowLeft":
        if (!is_left_col){
          // This.active_game = activeIndex - 1;
          updateActiveItem(grid_children[activeIndex - 1]);
        }
        break;
      case "ArrowRight":
        if (!is_right_col){
          // This.active_game = activeIndex + 1;
          updateActiveItem(grid_children[activeIndex + 1]);
        }
        break;
      case "RESET":
        // This.active_game = 0;
        updateActiveItem(grid_children[0]);
        break;
      case "NONE":
        // This.active_game = -1;
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