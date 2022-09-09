<template>
  <div>
    <div style="margin:0px 20px">
      <v-text-field v-model="filter" clearable placeholder="Search..." />
    </div>
    <ScrollablePanel :max_height="maxScrollable" @scroll="onScroll">
      <div class="games-container">
        <GogGame
          class="flex"
          v-for="val, i in gamesFiltered" :key="i" :game="val"
          :highlight="val.name === active"
          @remote="setNewRemote(val, $event)"
        />
      </div>
    </ScrollablePanel>
    <DLCSelectionModal />
    <VersionSelectionModal />
  </div>
</template>

<script lang="ts">
import { defineComponent } from "@vue/composition-api";
import DLCSelectionModal from "@modals/DLCSelectionModal.vue";
import { GOG } from "@/types/gog/game_info";
import GogGame from "../components/inserts/gog/GogGame.vue";
import {ipcRenderer as ipc} from "electron";
import ScrollablePanel from "@/components/general/ScrollablePanel.vue";
import VersionSelectionModal from "@modals/VersionSelectionModal.vue";

export default defineComponent({
  name: "GamesView",
  components: {
    DLCSelectionModal,
    GogGame,
    ScrollablePanel,
    VersionSelectionModal
  },
  props: {

  },
  data(){
    return {
      games: [] as GOG.GameInfo[],
      remote_games: [] as GOG.GameInfo[],
      active: undefined as undefined | string,
      timer: -1,
      filter: null as null | string,
      banner_on: false
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
  },
  methods: {
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