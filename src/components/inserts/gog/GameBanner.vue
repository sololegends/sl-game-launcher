<template>
  <v-toolbar dense class="game-banner elevation-2">
    <span class="game-name no-sel">{{game.name}}</span>
    <v-spacer />
    <span class="game-state">RUNNING</span>
    <v-btn icon @click="closeGame" tip-title="Close Game">
      <fa-icon icon="times" size="xl" />
    </v-btn>
  </v-toolbar>
</template>

<script lang="ts">
import { defineComponent } from "@vue/composition-api";
import { GOG } from "@/types/gog/game_info";
import {ipcRenderer as ipc} from "electron";

export default defineComponent({
  props: {
    game: {
      type: Object as () => GOG.GameInfo,
      required: true
    }
  },
  data(){
    return {

    };
  },
  computed: {

  },
  methods: {
    closeGame(){
      ipc.send("quit-game");
    }
  }
});
</script>

<style scoped>
.game-banner{
	background-color: var(--v-success-base)!important;
  top: 0px;
}
.game-state{
	font-weight: bold;
	font-size: 18px;
}
.game-name{
	font-weight: bold;
	font-size: 22px;
}
</style>