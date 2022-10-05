<template>
  <div id="settings">
    <SideDrawer name="Settings" :show="show" @click:outside="$emit('click:outside')">
      <v-list slot="body">

        <v-list-item @click="toggleTheme">
          <v-switch dense v-model="theme.dark_mode" label="Dark Mode" @click="toggleTheme"></v-switch>
        </v-list-item>

        <v-card-title class="primary header" style="padding: 0px 12px;">
          <div class="subtitle-1 white--text">GOG Games Folder</div>
          <v-spacer />
          <fa-icon
            style="cursor:pointer;margin-right:10px" class="subtitle-1 white--text" icon="folder"
            tip-title="Open GOG Folder" @click="openGOGFolder"
          />
        </v-card-title>

        <v-list-item @click="getFolder" class="gog-folder-item">
          <fa-icon icon="folder" size="xl" />
          <div class="h2 gog-path">{{gogPath}}</div>
        </v-list-item>

        <v-divider></v-divider>

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
        <v-list-item>
          Versions: {{procSize(cache.version_size)}}
          <v-spacer />
          <!-- <fa-icon
            style="cursor:pointer;transition:0.1s" class="subtitle-1" icon="trash-alt"
            tip-title="Clear Version Cache" @click="clearImageCache"
          /> -->
        </v-list-item>
      </v-list>


      <div slot="footer">
        <v-list-item @click="toggleDevMode">
          <v-switch dense v-model="dev_mode" label="Dev Mode" @click="toggleDevMode"></v-switch>
        </v-list-item>
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
import { defineComponent } from "@vue/composition-api";
import filter from "@filters";
import { GOG } from "@/types/gog/game_info";
import SideDrawer from "@modals/SideDrawer.vue";

type VersionData = {
  version: string
  build_date: string
}

type VersionDataMap = {
  [key: string]: VersionData
}

export default defineComponent({
  components: { SideDrawer },
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
      gog_path: undefined as undefined | string,
      webdav: {
        url: "",
        user: "",
        pass: "",
        folder: ""
      } as GOG.WebDavConfig,
      remote_save_folder: ".game-saves",
      version_copy_color: "white--text",
      cache: {
        data_size: -1,
        image_size: -1,
        version_size: -1,
        loading: true
      }
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
    this.reloadCacheData();
  },
  computed: {
    gogPath(): string{
      return this.gog_path === undefined ? "Select GOG Path" : this.gog_path;
    }
  },
  methods: {
    async reloadCacheData(){
      this.cache.loading = true;
      const s = new Date().getTime();
      this.cache.data_size = await ipc.invoke("data-cache-size");
      this.cache.image_size = await ipc.invoke("image-cache-size");
      this.cache.version_size = await ipc.invoke("version-cache-size");
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
      this.gog_path = path;
      ipc.send("cfg-set", "gog_path", this.gog_path);
      ipc.send("gog-path-change", this.gog_path);
    },
    saveWebDav(){
      ipc.send("cfg-set", "webdav", this.webdav);
      ipc.send("cfg-set", "remote_save_folder", this.remote_save_folder);
    },
    copyVersionInfo(): void{
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
    loadDevMode(): void{
      this.dev_mode = this.$store.getters.dev_mode;
    },
    toggleTheme(): void{
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
    async openGOGFolder(){
      ipc.send("open-folder", this.gogPath);
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