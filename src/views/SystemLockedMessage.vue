<template>
  <v-card class="system-card no-sel">
    <div class="text" style="font-size:1.5em">Uh oh! Can't launch the launcher.</div>
    <div class="text">Please contact your system administrator</div>
    <v-card-actions class="text-right">
      <v-spacer />
      <v-btn color="primary" @click="quit">Quit</v-btn>
    </v-card-actions>
  </v-card>
</template>

<script lang="ts">
import { defineComponent } from "@vue/composition-api";
import {ipcRenderer as ipc} from "electron";

export default defineComponent({
  name: "SystemLockedMessage",
  mounted(){
    this.$store.dispatch("set_minimal_ui", false);
    this.$store.dispatch("set_light_ui", true);
  },
  methods: {
    quit(){
      ipc.send("quit");
    }
  }
});
</script>

<style scoped>
.system-card{
  padding: 0px;
  height: 125px;
}
.system-card .text{
  padding-left: 10px;
  padding-top: 5px;
}
</style>