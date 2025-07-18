<template>
  <div id="settings">
    <SideDrawer name="Settings" :show="show" @click:outside="$emit('click:outside')">
      <v-list slot="body">

        <v-list-item @click="toggleAutoDLC">
          <v-switch dense v-model="auto_dlc" label="Auto download DLC on install" @click="toggleAutoDLC"></v-switch>
        </v-list-item>

        <v-list-item @click="toggleTheme">
          <v-switch dense v-model="theme.dark_mode" label="Dark Mode" @click="toggleTheme"></v-switch>
        </v-list-item>

        <v-list-item @click="toggleShowUninstalled">
          <v-switch dense v-model="show_uninstalled" label="Show Uninstalled" @click="toggleShowUninstalled"></v-switch>
        </v-list-item>

        <v-list-item @click="toggleShowRepackedOnly">
          <v-switch dense v-model="show_repacked_only" label="Show Repacked Only" @click="toggleShowRepackedOnly"></v-switch>
        </v-list-item>

        <v-list-item @click="toggleShowHiddenGames">
          <v-switch dense v-model="show_hidden_games" label="Show Hidden Games" @click="toggleShowHiddenGames"></v-switch>
        </v-list-item>

        <v-list-item @click="toggleOffline">
          <v-btn color="primary">Go {{ $store.getters.offline? "Online": "Offline" }}</v-btn>
        </v-list-item>

        <v-card-title class="primary header" style="padding: 0px 12px;">
          <div class="subtitle-1 white--text">Games Folder</div>
          <v-spacer />
          <fa-icon
            style="cursor:pointer;margin-right:10px" class="subtitle-1 white--text" icon="folder"
            tip-title="Open Game Folder" @click="openGamesFolder"
          />
        </v-card-title>

        <v-list-item @click="getFolder" class="gog-folder-item">
          <fa-icon icon="folder" size="xl" />
          <div class="h2 gog-path">{{gamesPath}}</div>
        </v-list-item>

        <v-divider></v-divider>

        <template v-if="backplane === 'webdav'">
          <v-card-title class="primary header" style="padding: 0px 12px;margin-bottom:18px">
            <div class="subtitle-1 white--text">WebDAV Configuration</div>
          </v-card-title>
          <v-list-item>
            <v-text-field dense v-model="webdav.url" label="WebDAV Url" />
          </v-list-item>
          <v-list-item>
            <v-text-field dense v-model="webdav.user" label="WebDAV User" />
          </v-list-item>
          <v-list-item>
            <v-text-field dense type="password" v-model="webdav.pass" label="WebDAV Pass" />
          </v-list-item>
          <v-list-item>
            <v-text-field dense v-model="webdav.folder" label="WebDAV Folder" />
          </v-list-item>
          <v-list-item>
            <v-text-field dense v-model="remote_save_folder" label="Cloud Save Folder" />
          </v-list-item>
          <v-list-item>
            <v-btn class="primary" @click="saveWebDav">
              Save Config
            </v-btn>
          </v-list-item>
        </template>

        <template v-else-if="backplane === 'sl_api'">
          <v-card-title class="primary header" style="padding: 0px 12px;margin-bottom:18px">
            <div class="subtitle-1 white--text">User Account</div>
          </v-card-title>
          <v-list-item>
            Logged in as: &nbsp;<b> {{ $store.getters.offline ? "offline" : api.user }}</b>
          </v-list-item>
          <v-list-item v-if="!$store.getters.offline">
            <v-btn class="primary" @click="logInOut">
              Sign {{ !api.user ? "In" : "Out"}}
            </v-btn>
            <v-spacer />
            <v-btn class="warning" @click="changePassword">
              Change Password
            </v-btn>
          </v-list-item>
        </template>

        <v-divider style="margin-top:20px;"></v-divider>

        <v-card-title class="primary header" style="padding: 0px 12px;">
          <div class="subtitle-1 white--text">Cache</div>
          <v-spacer />
          <fa-icon
            style="cursor:pointer;margin-right:10px" class="subtitle-1 white--text" icon="folder"
            tip-title="Open Cache Folder" @click="openCacheFolder"
          />
          <fa-icon
            style="cursor:pointer;transition:0.1s" class="subtitle-1" icon="redo-alt"
            tip-title="Refresh cache info" @click="reloadCacheData" :spin="cache.loading"
          />
        </v-card-title>
        <v-list-item>
          Data: {{procSize(cache.data_size)}}
          <v-spacer />
          <fa-icon
            style="cursor:pointer;transition:0.1s" class="subtitle-1" icon="trash-alt"
            tip-title="Clear Data Cache" @click="clearDataCache"
          />
        </v-list-item>
        <v-list-item>
          Icons: {{procSize(cache.image_size)}}
          <v-spacer />
          <fa-icon
            style="cursor:pointer;transition:0.1s" class="subtitle-1" icon="trash-alt"
            tip-title="Clear Icon Cache" @click="clearImageCache"
          />
        </v-list-item>

        <v-divider style="margin-top:20px;"></v-divider>

        <v-card-title class="primary header" style="padding: 0px 12px;">
          <div class="subtitle-1 white--text">Debugging</div>
        </v-card-title>

        <v-list-item @click="toggleDevMode">
          <v-switch dense v-model="dev_mode" label="Dev Mode" @click="toggleDevMode"></v-switch>
        </v-list-item>

        <v-list-item v-if="dev_mode">
          <LoggingDialog />
          <v-spacer />
          <v-btn class="warning" @click="openDevTools">
            Dev Tools
          </v-btn>
        </v-list-item>

        <v-list-item v-if="dev_mode">
          <v-select
            :items="[{text: 'stable', value: 'latest'}, {text: 'beta', value: 'beta'}]"
            label="Release Branch"
            v-model="update_channel"
            @change="channelChange"
          />
        </v-list-item>

        <v-list-item v-if="dev_mode">
          <v-select
            :items="[{text: 'API (new)', value: 'sl_api'}, {text: 'WebDAV (old)', value: 'webdav'}]"
            label="Remote Data Backplane"
            v-model="backplane"
            @change="backplaneChange"
          />
        </v-list-item>

        <v-list-item v-if="dev_mode && backplane === 'sl_api'">
          <v-text-field
            label="Remote Data API"
            v-model="games_api"
            @change="gamesApiChange"
          />
        </v-list-item>
      </v-list>


      <div slot="footer">
        <v-card>
          <v-card-title class="primary header" style="padding: 0px 12px;">
            <div class="subtitle-1 white--text">APP Version Information</div>
            <v-spacer />
            <span class="subtitle-1 white--text" v-if="version_copy_color === 'green--text'">Copied!</span>
            <fa-icon
              style="cursor:pointer;transition:0.1s" :class="'subtitle-1 '+version_copy_color" icon="copy"
              tip-title="Copy version info" @click="copyVersionInfo"
            />

          </v-card-title>
          <v-simple-table>
            <table style="width:100%;padding:5px 20px">
              <tbody>
                <tr v-for="item,key in version_data" :key="key">
                  <td class="subtitle-2">{{procKey(key)}}</td>
                  <td>:</td>
                  <td class="subtitle-2">{{item.version}}</td>
                  <td>:</td>
                  <td class="subtitle-2">{{item.build_date}}</td>
                </tr>
              </tbody>
            </table>
          </v-simple-table>
        </v-card>
      </div>
    </SideDrawer>
  </div>
</template>

<script lang="ts">
import { ipcRenderer as ipc, OpenDialogReturnValue } from "electron";
import { DEFAULT_API } from "@/plugins_bkg/config";
import { defineComponent } from "@vue/composition-api";
import filter from "@filters";
import { GOG } from "@/types/gog/game_info";
import LoggingDialog from "../dialogs/LoggingDialog.vue";
import { PlaneType } from "@/plugins_bkg/backplane";
import SideDrawer from "@modals/SideDrawer.vue";

type VersionData = {
  version: string
  build_date: string
}

type VersionDataMap = {
  [key: string]: VersionData
}

export default defineComponent({
  components: { SideDrawer, LoggingDialog },
  props: {
    show: {
      type: Boolean,
      required: true
    }
  },
  data(){
    return{
      version_data: {
        "app": { version: window.APP_VERSION, build_date: window.BUILD_DATE}
      } as VersionDataMap,
      theme: {
        dark_mode: false
      },
      dev_mode: false,
      games_path: undefined as undefined | string,
      webdav: {
        url: "",
        user: "",
        pass: "",
        folder: ""
      } as GOG.WebDavConfig,
      api: {
        user: "",
        pass: ""
      },
      remote_save_folder: ".game-saves",
      version_copy_color: "white--text",
      cache: {
        data_size: -1,
        image_size: -1,
        loading: true
      },
      show_uninstalled: true,
      show_repacked_only: true,
      show_hidden_games: false,
      auto_dlc: true,
      update_channel: "stable",
      backplane: "" as PlaneType,
      games_api: ""
    };
  },
  mounted(){
    this.loadTheme();
    this.loadDevMode();
    ipc.invoke("cfg-get", "gog_path").then((res) => {
      this.setGogFolder(res);
    });
    ipc.invoke("cfg-get", "remote_save_folder").then((res) => {
      this.remote_save_folder = res || ".game-saves";
    });
    ipc.invoke("cfg-get", "webdav").then((res) => {
      if(res !== undefined){
        this.webdav = res;
      }
    });
    ipc.invoke("cfg-get", "api").then((res) => {
      if(res !== undefined){
        this.api = res;
      }
    });
    ipc.invoke("cfg-get", "auto_dlc").then((res) => {
      this.auto_dlc = res || false;
    });
    ipc.invoke("cfg-get", "update_channel").then((res) => {
      this.update_channel = res || "stable";
    });
    ipc.invoke("cfg-get", "backplane").then((res) => {
      this.backplane = res || "webdav";
    });
    ipc.invoke("cfg-get", "remote_api").then((res) => {
      this.games_api = res || DEFAULT_API;
    });
    this.reloadCacheData();
    this.show_uninstalled = this.$store.getters.showUninstalled;
    this.show_repacked_only = this.$store.getters.showRepackedOnly;
  },
  computed: {
    gamesPath(): string{
      return this.games_path === undefined ? "Select Games Path" : this.games_path;
    }
  },
  methods: {
    openDevTools(){
      ipc.send("open-dev-tools");
    },
    channelChange(){
      ipc.send("cfg-set", "update_channel", this.update_channel);
      ipc.send("release-channel-changed", this.update_channel);
    },
    backplaneChange(){
      ipc.send("cfg-set", "backplane", this.backplane);
      this.$notify({
        title: "Data Backplane Changed!",
        text: "Restart required for changes to take effect",
        type: "success",
        sticky: true,
        action: {
          name: "Restart",
          event: "relaunch"
        }
      });
    },
    gamesApiChange(){
      ipc.send("cfg-set", "remote_api", this.games_api);
      this.$notify({
        title: "Game API Changed!",
        text: "Restart required for changes to take effect",
        type: "success",
        action: {
          name: "Restart",
          event: "relaunch"
        }
      });
    },
    toggleOffline(){
      this.$store.dispatch("set_offline", !this.$store.getters.offline);
      // Relaunch app
      ipc.send("relaunch");
    },
    toggleShowUninstalled(){
      this.$store.dispatch("set_show_uninstalled", this.show_uninstalled);
    },
    toggleAutoDLC(){
      this.$store.dispatch("set_auto_dlc", this.auto_dlc);
    },
    toggleShowHiddenGames(){
      this.$store.dispatch("set_show_hidden_games", this.show_hidden_games);
    },
    toggleShowRepackedOnly(){
      this.$store.dispatch("set_show_repacked_only", this.show_repacked_only);
    },
    async reloadCacheData(){
      this.cache.loading = true;
      const s = new Date().getTime();
      this.cache.data_size = await ipc.invoke("data-cache-size");
      this.cache.image_size = await ipc.invoke("image-cache-size");
      const e = new Date().getTime();
      if(e - s < 1000){
        setTimeout(() => {
          this.cache.loading = false;
        }, 750);
        return;
      }
      this.cache.loading = false;
    },
    async clearDataCache(){
      await ipc.invoke("data-cache-clear");
      this.reloadCacheData();
    },
    setupCloud(){
      ipc.send("initCloudEntries");
    },
    async clearImageCache(){
      await ipc.invoke("image-cache-clear");
      this.reloadCacheData();
    },
    getFolder(){
      const that = this;
      ipc.invoke("browse-folder").then((results: OpenDialogReturnValue) => {
        if(results && results?.filePaths.length > 0){
          that.setGogFolder(results?.filePaths[0]);
        }
      });

    },
    setGogFolder(path: string){
      this.games_path = path;
      ipc.send("cfg-set", "gog_path", this.games_path);
      ipc.send("gog-path-change", this.games_path);
    },
    saveWebDav(){
      ipc.send("cfg-set", "webdav", this.webdav, true);
      ipc.send("cfg-set", "remote_save_folder", this.remote_save_folder);
    },
    logInOut(){
      if(!this.api.user){
        ipc.send("login");
        return;
      }
      ipc.send("cfg-set", "api", {}, true);
      ipc.send("cfg-set", "sl_api_key", "", true);
      ipc.send("relaunch");
    },
    changePassword(){
      this.$modal.show("change_password", {
        message: "",
        username: this.api.user
      });
    },
    copyVersionInfo(){
      let string = "APP Versions";
      for(const key in this.version_data){
        string += "\n- " + key + ": " + this.version_data[key].version + " - " + this.version_data[key].build_date;
      }
      this.$fn.copyText(string);
      this.version_copy_color = "green--text";
      const that = this;
      setTimeout(
        function(){ that.version_copy_color = "white--text"; },
        2000
      );
    },
    toggleDevMode(){
      this.$store.dispatch("set_dev_mode", this.dev_mode);
    },
    loadDevMode(){
      this.dev_mode = this.$store.getters.dev_mode;
    },
    toggleTheme(){
      this.theme.dark_mode = !this.theme.dark_mode;
      this.$vuetify.theme.dark = this.theme.dark_mode;
      localStorage.setItem("theme", this.$vuetify.theme.dark ? "dark" : "light");
    },
    loadTheme(): void{
      this.$vuetify.theme.dark = localStorage.getItem("theme") !== "light";
      this.theme.dark_mode = this.$vuetify.theme.dark;
      // Set init (for the default to be properly registered in the explorer)
      localStorage.setItem("theme", this.$vuetify.theme.dark ? "dark" : "light");
    },
    async openCacheFolder(){
      const cache_folder = await ipc.invoke("cache-folder");
      ipc.send("open-folder", cache_folder);
    },
    async openGamesFolder(){
      ipc.send("open-folder", this.gamesPath);
    },
    procKey: filter.procKey,
    procSize: filter.formatSize
  }
});
</script>

<style scoped>
  .gog-folder-item{
    border-bottom:1px solid rgba(140, 130, 115, 0.42);
  }
  .gog-path{
    padding-left: 10px;
  }

  #settings .v-input{
    margin-top: 5px;
    margin-bottom: 5px;
  }
</style>