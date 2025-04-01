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
      <div class="overflow game-name no-sel" :title="options.title">{{options.title}}</div>
      <v-spacer />
      <span class="dl-eta" v-if="dl_eta">ETA: {{dl_eta}}</span>
      <span class="dl-speed" v-if="dl_speed">{{speed}}</span>
      <v-btn v-if="options.cancel_event" icon @click="cancel" tip-title="Cancel">
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
      dl_eta: undefined as undefined | string,
      dl_eta_hist: [] as number[],
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
    dlEta(){
      if(this.dl_eta_hist.length > 0 || this.dl_speed === undefined){
        this.dl_eta = "...";
      }
      let dl_eta = 0;
      for(const eta of this.dl_eta_hist){
        dl_eta += eta;
      }
      this.dl_eta = filter.betterSeconds(dl_eta / this.dl_eta_hist.length);
    },
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
      this.dl_eta = undefined;
      this.progress_percent = 0;
    },
    bannerProgress(e: unknown, progress: App.ProgressBannerProgress){
      this.in_error = false;
      this.calcProgress(progress);
      this.dl_speed = progress.speed;
      this.dl_total = progress.total;
      if(progress.speed){
        if(this.dl_eta_hist.unshift((progress.total - progress.progress) / progress.speed) > 5){
          this.dl_eta_hist = this.dl_eta_hist.slice(0, 4);
          this.dlEta();
        }
      }
    },
    bannerError(e: unknown, error: string){
      this.options.title = error;
      this.options.color = "red";
      this.options.indeterminate = false;
      this.in_error = true;
      this.dl_eta = undefined;
    },
    bannerHide(){
      this.in_error = false;
      this.show = false;
      this.dl_eta = undefined;
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
.dl-speed, .dl-eta{
	font-weight: bold;
	font-size: 18px;
  word-break: keep-all;
  white-space: nowrap;
  margin-left: 15px;
}
.overflow {
  height: 20px;
  max-width: 100%;
  padding: 0 10px 0 5px;
  position: relative;
  display: inline-block;
  text-decoration: none;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.game-name{
	font-weight: bold;
	font-size: 16px;
}
</style>