<template>
  <v-card class="save-sync-banner elevation-2" v-if="show">
    <span class="text-subtitle no-sel" style="margin-right: 10px">Cloud Sync: </span>
    <v-spacer />
    <div>
      {{game}}
    </div>
    <span style="margin: 0px 10px;">--</span>
    <div>
      {{state}}
    </div>
    <div v-if="processing" style="margin-left: 10px">
      <v-progress-circular
        size="20" style="margin-top: -4px"
        v-if="downloading" :value="downloading_val"
        :indeterminate="downloading_indeter"
      />
      <fa-icon
        v-else icon="spinner"
        class="rotate8"
      />
    </div>
  </v-card>
</template>

<script lang="ts">
import { ErrorStats, Stats } from "node-downloader-helper";
import { defineComponent } from "@vue/composition-api";
import { GOG } from "@/types/gog/game_info";
import {ipcRenderer as ipc} from "electron";

export default defineComponent({
  props: {
  },
  data(){
    return {
      show: false,
      processing: false,
      downloading: false,
      downloading_val: 0,
      downloading_indeter: false,
      game: "",
      state: ""
    };
  },
  computed: {
  },
  mounted(){
    ipc.on("save-game-sync-start", (e, game: GOG.GameInfo) => {
      this.show = true;
      this.game = game.name;
      this.processing = false;
      this.state = "Initializing cloud";
    });
    ipc.on("save-game-sync-search", (e, game: GOG.GameInfo) => {
      this.show = true;
      this.game = game.name;
      this.processing = true;
      this.state = "Checking for cloud save";
    });
    ipc.on("save-game-sync-state", (e, game: GOG.GameInfo, state: string) => {
      this.show = true;
      this.game = game.name;
      this.processing = false;
      this.state = state;
    });
    ipc.on("save-game-dl-progress", (e, game: GOG.GameInfo, state: string, p: Stats) => {
      this.show = true;
      this.game = game.name;
      this.downloading = true;
      this.downloading_val = (p.progress / p.total) * 100;
      this.downloading_indeter = p.progress === -1 || p.total === -1;
      this.state = state;
      this.processing = true;
    });
    ipc.on("save-game-stopped", () => {
      this.show = false;
      this.processing = false;
      this.game = "";
    });
    ipc.on("save-game-dl-error", (e, game: GOG.GameInfo, err: ErrorStats) => {
      this.show = true;
      this.processing = false;
      this.game = err.message;
    });
  },
  methods: {

  }
});
</script>

<style scoped>
.save-sync-banner{
	background-color: var(--v-primary-base)!important;
  position: fixed;
  bottom: 0px;
  left: 0px;
  height: 28px;
  width: auto;
  padding: 3px 10px;
  display: flex;
  text-align: left;
  vertical-align: middle;
  z-index: 999999;
}
.save-sync-state{
	font-weight: bold;
	font-size: 18px;
}
</style>