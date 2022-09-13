<template>
  <div class="page-container" :theme="$vuetify.theme.dark?'dark':'light'">
    <!-- MODALS -->
    <DetailsModal />
    <MessageModal />
    <GeneralConfirm ref="confirm_modal" />
    <GeneralPrompt ref="prompt_modal" />
    <SideNotify
      :show="show_side_notify"
      @count="notification_count=$event"
      @click:outside="show_side_notify=false"
    />
    <SettingsPanel :show="show_side_settings" @click:outside="show_side_settings=false" />

    <v-app>
      <NotificationsPanel :position="{left:10,bottom:0}" style="z-index:9999;" />
      <v-app-bar app color="primary elevation-3" dense>
        <h2 class="does-window-drag no-sel white--text">{{$properties.app}}</h2>
        <v-spacer class="does-window-drag h100" />
        <v-btn id="open_alert_drawer" icon @click="show_side_notify=true">
          <v-tab>
            <v-badge
              color="red"
              :content="notification_count"
              :value="notification_count>0"
            >
              <fa-icon icon="bell" size="2x" style="color:white" />
            </v-badge>
          </v-tab>
        </v-btn>
        <v-btn @click="show_side_settings=true" exact tip-title="Options" icon>
          <fa-icon icon="cog" size="2x" style="color:white" />
        </v-btn>
        <v-btn @click="minimize" exact tip-title="Minimize" icon>
          <fa-icon icon="minus" size="2x" style="color:white" />
        </v-btn>
        <v-btn @click="doMaxRestore" exact :tip-title="win_max_restore_title" icon>
          <fa-icon :icon="win_max_restore" size="2x" style="color:white" />
        </v-btn>
        <v-btn @click="exit" exact tip-title="Exit" icon>
          <fa-icon icon="times" size="2x" style="color:white" />
        </v-btn>
      </v-app-bar>

      <v-main class="main-view">
        <GameBanner :game="running_game"  v-if="running_game !== undefined" />
        <div v-if="disconnected">
          <div class="centered-container">
            <v-card style="">
              <v-toolbar class="primary" height="175px">
                <div class="connection-failure">
                  <img src="./assets/logo.png">
                  <div class="title white--text">{{$properties.company}} {{$properties.app}}</div>
                  <div class="text-subtitle-2 white--text" tip-title="Connection Failure">Connection Failure</div>
                </div>
              </v-toolbar>
              <v-card-text>
                <div class="body-slot center">
                  Connection with the {{$properties.app}} server appears to be lost!
                  <br>
                  Please check your network connection.
                  <br><br>
                  When connection is restored this page should automatically re-load, otherwise refresh to try again.
                </div>
              </v-card-text>
            </v-card>
          </div>
        </div>
        <div class="app-view" v-else>
          <router-view />
        </div>
      </v-main>
    </v-app>
  </div>
</template>

<script lang="ts">
import { defineComponent } from "@vue/composition-api";
import DetailsModal from "@modals/DetailsModal.vue";
import GameBanner from "@inserts/gog/GameBanner.vue";
import GeneralConfirm from "@modals/GeneralConfirm.vue";
import { GeneralPopup } from "confirmation_modal";
import GeneralPrompt from "@modals/GeneralPrompt.vue";
import { GOG } from "./types/gog/game_info";
import { ipcRenderer as ipc } from "electron";
import MessageModal from "@modals/MessageModal.vue";
import NotificationsPanel from "@plugins/NotificationsPanel.vue";
import SettingsPanel from "@modals/SettingsPanel.vue";
import SideNotify from "@dialogs/SideNotify.vue";
import {tool_tips} from "@js/tool_tips";

export default defineComponent({
  components: {
    DetailsModal,
    MessageModal,
    NotificationsPanel,
    SideNotify,
    GameBanner,
    GeneralConfirm,
    GeneralPrompt,
    SettingsPanel
  },
  name: "App",
  data(){
    return {
      show_side_notify: false,
      show_side_settings: false,
      notification_count: 0,
      disconnected: false,
      menu: {
        dev: true
      },
      running_game: undefined as undefined | GOG.GameInfo,
      win_max_restore: "window-maximize",
      win_max_restore_title: "Maximize"
    };
  },
  mounted(){
    window.confirm_modal = this.$refs.confirm_modal as GeneralPopup.ConfirmModal;
    window.prompt_modal = this.$refs.prompt_modal as GeneralPopup.PromptModal;
    tool_tips.init();
    ipc.on("game-running-changed", (e, game: GOG.GameInfo) => {
      this.running_game = game;
    });

    ipc.on("notify", (e, notify) => {
      this.$notify(notify);
    });

    ipc.on("win-maximize", () => {
      this.win_max_restore = "window-restore";
      this.win_max_restore_title = "Restore";
    });

    ipc.on("win-restore", () => {
      this.win_max_restore = "window-maximize";
      this.win_max_restore_title = "Maximize";
    });
  },
  computed: {

  },
  methods: {
    exit(){
      ipc.send("quit");
    },
    doMaxRestore(){
      if(this.win_max_restore === "window-restore"){
        this.winRestore();
        return;
      }
      this.maximize();
    },
    minimize(){
      ipc.send("minimize");
    },
    maximize(){
      ipc.send("maximize");
    },
    winRestore(){
      ipc.send("win-restore");
    }
  }
});
</script>

<style scoped>
  .toolbar-section-end{
    justify-content: flex-end;
    display: flex;
    align-items: center;
    flex: 1;
  }
  .breadcrumb{
    padding:0px;
    height:45px;
    line-height:45px;
    margin-bottom:0px;
    padding:0px 10px;
  }

  .breadcrumb .md-title{
    line-height:45px;
  }
  .notification{
    left:65px;
  }
</style>

<style>
  .does-window-drag {
    -webkit-app-region: drag;
  }
  .h100{
    height:100%;
  }
  body, html, .v-application{
    overflow:hidden!important;
    height:100vh;
    width:100vw;
  }
  .v-main{
    max-height: 100vh;
  }
  .app-view{
    overflow: hidden;
    width:calc(100% - 5px);
    height:calc(100vh - 45px);
    padding-bottom: 5px;
    z-index:1;
  }
  .error-message {
    color: var(--md-theme-default, #FF0000);
  }
  .status-block{
    background-color: #EEAA22;
    border-radius: 7px;
    padding:3px 7px;
    font-weight:bold;
    color:var(-v-text--light);
  }
  .status-block.status-failed{
    background-color: #FF0000;
  }
  .status-block.status-successful, .status-block.status-success{
    background-color: #22AA22;
  }
  .status-block.status-canceled{
    background-color: #EEAA22;
  }
  .no-display{
    display:none;
  }
  .no-display{
    display:none;
  }
  .no-events{
    pointer-events:none;
  }
  .pointer{
    cursor: pointer;
  }
  .no-sel{
    -webkit-user-select: none;  /* Chrome all / Safari all */
    -moz-user-select: none;     /* Firefox all */
    -ms-user-select: none;      /* IE 10+ */
    user-select: none;          /* Likely future */
  }
  .centered-container {
    display: flex;
    align-items: center;
    justify-content: center;
    position: relative;
    height: 85vh;
    padding: 40px;
  }
  .centered-text{
    text-align: center;
  }
  .rotate8{
    animation: transform8 1s steps(1) infinite;
  }
  @keyframes transform8 {
    0%   {transform: rotate(0deg);}
    12%  {transform: rotate(45deg);}
    25%  {transform: rotate(90deg);}
    37% {transform: rotate(135deg);}
    50% {transform: rotate(180deg);}
    62% {transform: rotate(225deg);}
    75% {transform: rotate(270deg);}
    87% {transform: rotate(315deg);}
    100% {transform: rotate(360deg);}
  }
  /* Vuetify Overrides */
  .v-chip.v-size--default{
    height:26px!important;
  }
  .v-chip--select{
    margin:5px 4px!important;
  }
  .theme--light.v-btn.v-btn--icon.v-btn--round{
    color:initial;
  }
  .flex{
    display: flex;
  }
  .flex.justify-even{
    justify-content: space-evenly;
    flex-flow: wrap;
  }
  .flex.justify-start{
    justify-content: flex-start;
    flex-flow: wrap;
  }

  .thin-scrollbar{
    scrollbar-width: thin;
  }
  .page-container[theme=dark] * {
    scrollbar-color: #454a4d #202324;
  }

  /* width */
  ::-webkit-scrollbar {
    width: 8px;
    cursor: pointer;
  }
  /* Track */
  ::-webkit-scrollbar-track {
    background: rgba(128,128,128,0.25);
  }

  /* Handle */
  ::-webkit-scrollbar-thumb {
    background: var(--v-primary-base);
    border-radius: 3px;
  }

  /* Handle on hover */
  ::-webkit-scrollbar-thumb:hover {
    background: #01579B;
  }
</style>
