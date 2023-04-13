<template>
  <div class="page-container" :theme="$vuetify.theme.dark?'dark':'light'">
    <!-- MODALS -->
    <DetailsModal />
    <MessageModal />
    <GeneralConfirm ref="confirm_modal" />
    <GeneralPrompt ref="prompt_modal" />
    <GeneralQuestion ref="question_modal" />
    <SideNotify
      v-if="isFull"
      :show="show_side_notify"
      @count="notification_count=$event"
      @click:outside="show_side_notify=false"
    />
    <SettingsPanel v-if="isFull" :show="show_side_settings" @click:outside="show_side_settings=false" />

    <v-app>
      <NotificationsPanel v-if="isFull" :position="{left:10,bottom:10}" style="z-index:9999;" />
      <span v-if="$store.getters.offline" class="text-centered">OFFLINE</span>
      <v-app-bar v-if="isFull" app color="primary elevation-3" dense>
        <v-avatar size="40" />
        <h2 class="does-window-drag no-sel white--text">{{$properties.app}}</h2>
        <v-spacer class="does-window-drag h100" />
        <v-btn id="open_alert_drawer" icon @click="show_side_notify=true">
          <v-tab>
            <v-badge
              color="red"
              :content="notification_count"
              :value="notification_count>0"
              offset-x="12"
              offset-y="13"
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
      <v-app-bar v-else app color="primary elevation-3" height="30">
        <h3 class="no-sel white--text">{{$properties.app}}</h3>
        <v-spacer class="h100" />
        <v-btn @click="exit" exact tip-title="Exit" icon>
          <fa-icon icon="times" size="2x" style="color:white" />
        </v-btn>
      </v-app-bar>

      <v-main :class="'main-view' + (isFull ? '' : ' minimal')">
        <div v-if="isFull && isOffline" class="offline-notice">
          <div class="text no-sel">
            Offline Mode
          </div>
        </div>
        <GameBanner :game="running_game"  v-if="running_game !== undefined" />
        <div :class="'app-view' + (isFull ? '' : ' minimal')">
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
import GeneralQuestion from "@modals/GeneralQuestion.vue";
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
    GeneralQuestion,
    SettingsPanel
  },
  name: "App",
  data(){
    return {
      show_side_notify: false,
      show_side_settings: false,
      notification_count: 0,
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
    window.question_modal = this.$refs.question_modal as GeneralPopup.QuestionModal;
    tool_tips.init();
    ipc.on("game-running-changed", (e, game: GOG.GameInfo) => {
      this.running_game = game;
    });

    ipc.on("notify", (e, notify, group) => {
      this.$notify(notify, group);
    });

    ipc.on("question", async(e, message, title, options) => {
      const response = await this.question(message, title, options);
      if(response === "CLOSED" || response === "CANCELED"){
        ipc.send("question_canceled");
        return;
      }
      ipc.send(response);
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
    isFull(){
      return !this.$store.getters.minimal_ui;
    },
    isOffline(){
      return this.$store.getters.offline;
    }
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
    },
    toggleSettings(){
      this.show_side_settings = !this.show_side_settings;
    },
    toggleNotify(){
      this.show_side_notify = !this.show_side_notify;
    },
    async checkOffline(){
      this.$store.dispatch("set_offline", await ipc.invoke("cfg-get", "offline") === true);
    }
  },
  beforeMount(): void{
    this.$store.dispatch("set_minimal_ui", true);
    this.checkOffline();
    this.$app._cont.$on("toggle_settings", this.toggleSettings);
    this.$app._cont.$on("toggle_notify", this.toggleNotify);
  },
  beforeDestroy(): void{
    this.$app._cont.$off("toggle_settings", this.toggleSettings);
    this.$app._cont.$off("toggle_notify", this.toggleNotify);
  }
});
</script>

<style scoped>
  .offline-notice{
    position: absolute;
    top: 0px;
    left: 0px;
    height: 100%;
    width: 100%;
    border: 5px solid;
    border-color: var(--v-warning-base);
    border-radius: 5px;
  }
  .offline-notice .text{
    background-color: var(--v-warning-base);
    position: absolute;
    bottom: 0px;
    right: 0px;
    border-top-left-radius: 5px;
    padding:2px 5px 0px 5px;
    z-index: 9999;
  }
  .main-view{
    padding: 0px;
    top: 0px;
    position: fixed;
    width:100%
  }
  .main-view.minimal{
    margin: 0px;
  }
  .app-view{
    overflow: hidden;
    width:calc(100% - 5px);
    height:calc(100vh - 45px);
    padding-bottom: 5px;
    z-index:1;
  }
  .app-view.minimal{
    width:100vw;
    height:100vh;
  }
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
