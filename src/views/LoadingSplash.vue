<template>
  <v-card class="question-card no-sel" v-if="show_options">
    <div class="text">Failed to contact server!</div>
    <v-card-actions class="text-right">
      <v-spacer />
      <v-btn small color="primary" @click="goOffline">Go Offline</v-btn>
      <v-btn small color="primary" @click="quit">Quit</v-btn>
    </v-card-actions>
  </v-card>
  <v-card class="update-card" v-else>
    <v-progress-linear
      class="update-progress" :indeterminate="indeterminate"
      :value="dl_value" height="25"
    >
      <template>
        <span class="text">{{ message }}</span>
        <v-spacer />
        <span class="text2">{{ dl_progress }}</span>
      </template>
    </v-progress-linear>
  </v-card>
</template>

<script lang="ts">
import { ProgressInfo, UpdateInfo } from "electron-updater";
import { defineComponent } from "@vue/composition-api";
import filters from "@/js/filters";
import {ipcRenderer as ipc} from "electron";

export default defineComponent({
  name: "UpdateSplash",
  components: {
  },
  props: {

  },
  data(){
    return {
      message: "Loading...",
      dl_progress: "",
      dl_value: 0,
      indeterminate: false,
      show_options: false
    };
  },
  computed: {
  },
  mounted(){
    this.$store.dispatch("set_minimal_ui", true);
    ipc.on("download-progress", this.dlProgress);
    ipc.on("update-downloaded", this.dlFinished);
    ipc.on("update-available", this.downloadUpdate);
    ipc.on("update-not-available", this.upToDate);
    this.checkForUpdate();
  },
  beforeDestroy(){
    ipc.off("download-progress", this.dlProgress);
    ipc.off("update-downloaded", this.dlFinished);
    ipc.off("update-available", this.downloadUpdate);
    ipc.off("update-not-available", this.upToDate);
  },
  methods: {
    dlProgress(e: unknown, progress: ProgressInfo){
      console.log(progress);
      this.dl_value = progress.percent;
      this.dl_progress = filters.formatSize(progress.bytesPerSecond, "Bps");
    },
    dlFinished(){
      this.message = "Update downloaded! Installing...";
      this.indeterminate = false;
      this.dl_progress = "";
      this.dl_value = 0;
      ipc.send("install-update");
    },
    checkForUpdate(){
      this.message = "Checking for updates...";
      this.dl_progress = "";
      this.indeterminate = true;
      ipc.invoke("check-for-update").catch((e: unknown) => {
        this.message = "Update Check failed!";
        console.log(e);
        this.showOptions();
      });
    },
    downloadUpdate(e: unknown, update_info: UpdateInfo){
      this.message = "Download version " + update_info.version;
      this.indeterminate = false;
      ipc.invoke("download-update").catch((e) => {
        this.message = "Download failed!";
        this.indeterminate = false;
        this.dl_value = 0;
        this.dl_progress = "";
        console.log(e);
        this.showOptions();
      });
    },
    showOptions(){
      this.show_options = true;
    },
    quit(){
      ipc.send("quit");
    },
    goOffline(){
      this.$store.dispatch("set_offline", true);
      console.log("Go to main window");
      ipc.send("goto-main-window");
    },
    upToDate(){
      this.$store.dispatch("set_offline", false);
      console.log("Go to main window");
      ipc.send("goto-main-window");
    }
  }
});
</script>

<style scoped>
.update-card{
  padding: 20px;
  height: 70px;
}
.question-card{
  padding: 0px;
  height: 70px;
}
.question-card .text{
  padding-left: 10px;
  padding-top: 5px;
}
.update-progress{
  border-radius: 5px;
}
.update-progress .text{
  padding-left: 10px;
}
.update-progress .text2{
  padding-right: 10px;
}

</style>