<template>
  <v-progress-linear
    v-if="show"
    height="30" class="game-banner elevation-2" stream
    :buffer-value="progress_percent"
    :value="progress_percent"
    :indeterminate="options.indeterminate"
    :color="options.color"
  >
    <template>
      <span class="game-name no-sel">{{options.title}}</span>
      <v-spacer />
      <span class="dl-speed" v-if="dl_speed">{{speed}}</span>
      <v-btn icon @click="cancel" tip-title="Cancel">
        <fa-icon icon="times" size="xl" />
      </v-btn>
    </template>
  </v-progress-linear>
</template>

<script lang="ts">
import { App } from "@/types/app";
import { defineComponent } from "@vue/composition-api";
import filter from "@js/filters";
import {ipcRenderer as ipc} from "electron";
import Vue from "vue/types/umd";

export interface DIBanner extends Vue{
  cancel: () => void
}

export default defineComponent({
  props: {
  },
  data(){
    return {
      progress_percent: 0,
      show: false,
      dl_speed: undefined as undefined | number,
      options: {
        title: "None",
        indeterminate: false
      } as App.ProgressBannerOpts
    };
  },
  mounted(){
    // GENERIC CONTROLS
    ipc.on("progress-banner-init", this.bannerInit);
    ipc.on("progress-banner-progress", this.bannerProgress);
    ipc.on("progress-banner-error", this.bannerError);
    ipc.on("progress-banner-hide", this.bannerHide);
  },
  beforeDestroy(){
    ipc.off("progress-banner-init", this.bannerInit);
    ipc.off("progress-banner-progress", this.bannerProgress);
    ipc.off("progress-banner-error", this.bannerError);
    ipc.off("progress-banner-hide", this.bannerHide);
  },
  computed: {
    speed(): string{
      return this.dl_speed === undefined ? "" : filter.formatSize(this.dl_speed, "Bps");
    }
  },
  methods: {
    bannerInit(e: unknown, options: App.ProgressBannerOpts | string){
      this.in_error = false;
      if(typeof options === "string"){
        options = {
          title: options
        };
      }
      options.color = options.color || "teal";
      options.indeterminate = options.indeterminate || false;
      this.options = options;
      this.show = true;
      this.dl_speed = undefined;
      this.progress_percent = 0;
    },
    bannerProgress(e: unknown, progress: App.ProgressBannerProgress){
      this.in_error = false;
      this.calcProgress(progress);
      this.dl_speed = progress.speed;
    },
    bannerError(e: unknown, error: string){
      this.options.title = error;
      this.options.color = "red";
      this.in_error = true;
    },
    bannerHide(){
      this.in_error = false;
      this.show = false;
    },
    calcProgress(prog : App.ProgressBannerProgress){
      this.progress_percent = Math.floor((prog.progress / prog.total) * 100);
    },
    cancel(){
      if(this.in_error){
        this.show = false;
      }
      if(this.options.cancel_event){
        ipc.send(this.options.cancel_event, this.options.cancel_data);
      }
    }
  }
});
</script>

<style scoped>
.dl-speed{
	font-weight: bold;
	font-size: 18px;
}
.game-name{
  padding-left: 10px;
	font-weight: bold;
	font-size: 16px;
}
</style>