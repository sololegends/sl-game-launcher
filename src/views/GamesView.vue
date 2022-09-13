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
          :class="'flex' + (active_grid_ele === i? ' active' : '')"
          :ref="'game' + i"
          :running="val.name === active"
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
      active_grid_ele: -1,
      active_game: -1,
      flex_id: "#game_flex",
      active_class: "active",
      disable_mouse: false,
      disable_mouse_to: -1
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
        this.disable_mouse = true;
        this.navigateGrid("ArrowUp");
        this.enableMouseTO();
      });
      this.$g_on([ "d_down", "ls_down" ], () => {
        this.disable_mouse = true;
        this.navigateGrid("ArrowDown");
        this.enableMouseTO();
      });
      this.$g_on([ "d_right", "ls_right" ], () => {
        this.navigateGrid("ArrowRight");
      });
      this.$g_on([ "d_left", "ls_left" ], () => {
        this.navigateGrid("ArrowLeft");
      });
      this.$g_on("a", () => {
        this.triggerGameAction();
      });
      this.$g_on("b", () => {
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
    navigateGrid: function(direction_id: string | number, active_class?: string, flexbox_grid?: string){
      if(!flexbox_grid){
        flexbox_grid = this.flex_id;
      }
      if(!active_class){
        active_class = this.active_class;
      }
      const grid = document.querySelector(flexbox_grid);
      if(grid === null){
        console.log("Failed to find element with selector: [" + flexbox_grid + "]");
        return;
      }

      const updateActiveItem = (active: HTMLElement | null, next: HTMLElement | null, active_class: string) => {
        if(active){
          active.classList.remove(active_class);
        }
        if(next){
          next.classList.add(active_class);
          const br = next.getBoundingClientRect();
          if(br.y >= window.innerHeight - br.height || br.y < br.height){
            next.scrollIntoView({behavior: "smooth", block: "nearest"});
          }
          this.active_game = parseInt(next.getAttribute("data-game") || "-1");
        }else{
          this.active_game = -1;
        }
      };
      const active = grid.querySelector(`.${active_class}`) as HTMLElement;
      if(active === null){
        updateActiveItem(null, null, "active");
      }
      const grid_children = Array.from(grid.children) as HTMLElement[];
      const activeIndex = grid_children.indexOf(active);

      const grid_num = grid_children.length;
      if(grid_num === 0){
        return;
      }
      const base_offset = grid_children[0].offsetTop;
      const break_index = grid_children.findIndex(item => item.offsetTop > base_offset);
      const num_per_rpw = (break_index === -1 ? grid_num : break_index);


      const is_top_row = activeIndex <= num_per_rpw - 1;
      const is_bottom_row = activeIndex >= grid_num - num_per_rpw;
      const is_left_col = activeIndex % num_per_rpw === 0;
      const is_right_col = activeIndex % num_per_rpw === num_per_rpw - 1 || activeIndex === grid_num - 1;

      if(typeof direction_id !== "string"){
        updateActiveItem(active, grid_children[direction_id], active_class);
        return;
      }
      switch (direction_id){
      case "ArrowUp":
        if (!is_top_row){
          updateActiveItem(active, grid_children[activeIndex - num_per_rpw], active_class);
        }
        break;
      case "ArrowDown":
        if (!is_bottom_row){
          updateActiveItem(active, grid_children[activeIndex + num_per_rpw], active_class);
        }
        break;
      case "ArrowLeft":
        if (!is_left_col){
          updateActiveItem(active, grid_children[activeIndex - 1], active_class);
        }
        break;
      case "ArrowRight":
        if (!is_right_col){
          updateActiveItem(active, grid_children[activeIndex + 1], active_class);
        }
        break;
      case "RESET":
        updateActiveItem(active, grid_children[0], active_class);
        break;
      case "NONE":
        updateActiveItem(active, null, active_class);
        break;
      default: return;
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