<template>
  <v-card
    class="game-card" v-observe-visibility="visibilityChanged"
    :title="isRemote?'Install Game':'Launch Game'"
    @contextmenu.prevent="contextMenu"
  >
    <div :class="'image' + (isRemote? ' uninstalled' : '')" @click="launchGame">
      <v-progress-circular style="margin:auto" indeterminate size="100"  v-if="image === undefined" />
      <fa-icon v-else-if="image === '404'" class="remote-icon" size="5x" icon="cloud-download-alt" />
      <img v-else :src="image" width="200" />
    </div>
    <div :class="'name' + (highlight? ' active' : '')">
      <span :title="game.name">{{game.name}}</span>
    </div>

    <!-- Remote only stuffs -->
    <div v-if="isRemote">
      <div class="install-btn" tip-title="Download and Install" @click="downloadAndInstall">
        <v-progress-circular v-if="loading" indeterminate size="20"></v-progress-circular>
        <fa-icon size="lg" icon="download" v-else />
      </div>
    </div>

    <!-- Installed only stuffs -->
    <div v-else>
      <div class="uninstall-btn" tip-title="Uninstall" @click="uninstall">
        <v-progress-circular v-if="loading" indeterminate size="20"></v-progress-circular>
        <fa-icon size="lg" icon="trash-alt" v-else />
      </div>
    </div>

    <div class="size-note" v-if="downloadSize || installSize">
      <span v-if="downloadSize" tip-title="Download Size">
        {{formatSize(downloadSize)}}
      </span>
      <span v-if="downloadSize && installSize"> / </span>
      <span v-if="installSize" tip-title="Install Size">
        {{formatSize(installSize)}}
      </span>
    </div>

    <!-- Admin Only -->
    <div v-if="$store.getters.dev_mode && !isRemote">
      <div class="package-btn" tip-title="Package Game" @click="packageGame">
        <v-progress-circular v-if="loading_archival" indeterminate size="20"></v-progress-circular>
        <fa-icon size="lg" icon="archive" v-else />
      </div>
    </div>

    <div class="version-note" v-if="game.current_version">
      {{game.current_version}}
    </div>
    <v-contextmenu v-model="context_menu" :items="items" />
  </v-card>
</template>

<script lang="ts">
import { ContextMenu } from "@/components/plugins/context-menu/context-menu";
import { defineComponent } from "@vue/composition-api";
import filters from "@/js/filters";
import { GOG } from "@/types/gog/game_info";
import {ipcRenderer as ipc} from "electron";

export default defineComponent({
  props: {
    game: {
      type: Object as () => GOG.GameInfo,
      required: true
    },
    highlight: {
      type: Boolean,
      required: false,
      default: false
    }
  },
  data(){
    return {
      image: undefined as undefined | string,
      loading: false,
      loading_archival: false,
      context_menu: {
        show: false,
        x: 0,
        y: 0
      } as ContextMenu.Bind
    };
  },
  computed: {
    downloadSize(): number | undefined{
      return this.game.remote?.dl_size;
    },
    installSize(): number | undefined{
      return this.game.install_size || this.game.remote?.install_size;
    },
    isRemote(): boolean{
      return this.game.webcache === "remote";
    },
    items(): ContextMenu.MenuItem[]{
      const items = [];
      if(this.isRemote){
        items.push({
          title: "Install",
          click: this.downloadAndInstall,
          icon: "hdd"
        });
        items.push({
          title: "Download",
          click: this.download,
          icon: "download"
        });
      }else {
        items.push({
          title: "Uninstall",
          click: this.uninstall,
          icon: "trash-alt"
        });
      }
      if(this.game.remote !== undefined){
        if(this.game.remote.dlc.length > 0){
          items.push({
            title: "View DLC",
            click: this.showDLC,
            icon: "cubes"
          });
        }
        if(this.game.remote.versions && Object.keys(this.game.remote.versions).length > 0){
          items.push({
            title: "Alt. Versions",
            click: this.showVersions,
            icon: "cubes"
          });
        }
      }
      if(this.$store.getters.dev_mode){
        if(!this.isRemote){
          items.push({
            title: "Package",
            click: this.packageGame,
            icon: "archive"
          });
        }
        items.push({
          title: "Reload Cache",
          click: this.reloadCache,
          icon: "redo-alt"
        });
        items.push({
          title: "Show Data",
          click: this.showDataDev,
          icon: "eye"
        });
      }
      items.push({
        title: "Close",
        click: () => { this.show_menu = false; },
        icon: "times"
      });
      return items;
    }
  },
  watch: {
    "game": function(){
      this.image = undefined;
      this.loadImage();
    }
  },
  methods: {
    showDataDev(){
      this.$modal.show("message", {
        api_output: JSON.stringify(this.game, null, 2),
        message: "Game Data"
      });
    },
    contextMenu(e: MouseEvent){
      this.show_menu = false;
      this.context_menu.x = e.clientX;
      this.context_menu.y = e.clientY;
      this.$nextTick(() => {
        this.context_menu.show = true;
      });
    },
    showVersions(){
      if(this.game.remote){
        this.$modal.show("versions_viewer", {
          versions: this.game.remote.versions,
          game: this.game,
          game_slug: this.game.remote.slug
        });
      }
    },
    showDLC(){
      if(this.game.remote){
        this.$modal.show("dlv_viewer", {
          dlc: this.game.remote.dlc,
          game: this.game,
          game_slug: this.game.remote.slug
        });
      }
    },
    loadImage(): void{
      // Load image
      ipc.invoke("get-image", "logo2x", this.game).then((res: GOG.ImageResponse) => {
        this.image = res.icon;
        if(res.remote){
          this.$emit("remote", res.remote);
        }else{
          console.log("remote undefiend for " + this.game.name);
        }
      });
    },
    visibilityChanged(isVisible: boolean): void{
      if(isVisible && this.image === undefined){
        this.loadImage();
      }
    },
    reloadCache(){
      this.image = undefined;
      ipc.invoke("reload-cache-data", this.game).then(async({remote, icon}) => {
        this.$emit("remote", remote);
        this.image = icon;
      });
    },
    packageGame(): void{
      this.loading_archival = true;
      ipc.on("zip-package-done", this.loadingOff);
      ipc.send("zip-package-make", this.game);
    },
    downloadAndInstall(e: MouseEvent): void{
      this.loading = true;
      ipc.on("game-dl-start", this.loadingOff);
      ipc.on("game-dl-error", this.loadingOff);
      if(e.ctrlKey){
        this.download();
        return;
      }
      ipc.send("install-game", this.game);
    },
    download(): void{
      ipc.send("download-game", this.game);
    },
    uninstall(): void{
      this.loading = true;
      ipc.on("game-uns-start", this.loadingOff);
      ipc.on("game-uns-error", this.loadingOff);
      ipc.send("uninstall-game", this.game);
    },
    loadingOff(): void{
      this.loading = false;
      this.loading_archival = false;
      ipc.off("game-dl-start", this.loadingOff);
      ipc.off("game-dl-error", this.loadingOff);
      ipc.off("game-uns-start", this.loadingOff);
      ipc.off("game-uns-error", this.loadingOff);
      ipc.off("zip-package-done", this.loadingOff);
    },
    launchGame(): void{
      for(const i in this.game.playTasks){
        const task = this.game.playTasks[i];
        if(task.isPrimary){
          ipc.invoke("run-game", this.game).then((started: boolean) => {
            if(started){
              ipc.send("game-running-changed", this.game);
            }else{
              this.$notify({
                type: "error",
                title: "Failed to launch Game!",
                text: this.game.name
              });
            }
          });
          return;
        }
      }
    },
    formatSize(size: number | undefined): string{
      if(size === undefined){
        return "";
      }
      return filters.formatSize(size, "iB");
    }
  }
});
</script>

<style scoped>
	.game-card{
		margin: 10px;
		width: 200px;
		height: 175px;
		max-width: 200px;
		max-height: 175px;
		border-radius: 5px;
		background-color: var(--v-data-table-hover-base);
		cursor: pointer;
		box-shadow: 0px 2px 1px -1px rgb(0 0 0 / 20%),
			0px 1px 1px 0px rgb(0 0 0 / 14%),
			0px 1px 3px 0px rgb(0 0 0 / 12%);
		transition: 0.3s;

		display: flex;
		flex-direction: column;
		text-align: center;
	}

	.game-card:hover{
		box-shadow: 0px 2px 4px -1px rgb(0 0 0 / 20%),
		0px 4px 5px 0px rgb(0 0 0 / 14%),
		0px 1px 10px 0px rgb(0 0 0 / 12%);
		top: -2px;
	}

	.image{
    display: flex;
		width: 200px;
		height: 120px;
    border-bottom:1px solid rgba(140, 130, 115, 0.42);
	}
  .image>img{
		border-top-left-radius: 5px;
		border-top-right-radius: 5px;
  }

	.image>.v-progress-circular{
		margin-top:10px;
	}
	.image.uninstalled{
		opacity: 0.8;
	}

	.name{
		font-size: 14px;
		font-weight:bold;
		flex-grow:1;
		vertical-align: middle;
    display: flex;
    justify-content: space-around;
    align-items: center;
	}
	.name.active{
		background-color: var(--v-success-base)!important;
		border-bottom-left-radius: 5px;
		border-bottom-right-radius: 5px;
	}
	.name>span{
		max-height: 55px;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.remote-icon{
		margin:auto;
		opacity: 0.75;
	}

  .install-btn, .uninstall-btn, .package-btn, .size-note{
    width: 35px;
    height: 35px;
    display: flex;
    justify-content: space-around;
    align-items: center;
    background-color: rgba(0, 0, 0, 0.5);
    color: #C8C3BC;

    position: absolute;
    right:0px;
    top:0px;
		border-top-right-radius: 5px;
		border-bottom-left-radius: 5px;
  }
  .install-btn:hover, .uninstall-btn:hover, .package-btn:hover{
    background-color: rgba(0, 0, 0, 0.7);
  }
  .uninstall-btn{
    left:0px;
		border-top-right-radius: 0px;
		border-bottom-left-radius: 0px;
		border-top-left-radius: 5px;
		border-bottom-right-radius: 5px;
  }
  .size-note{
    left: 0px;
    bottom: 55px;
    top: unset;
    width: unset;
    height: 19px;
		border-radius: 0px;
  }
  .version-note{
    font-size: 10px;
    position: absolute;
    padding: 0px 5px;
    left: 0px;
    bottom: 0px;
		border-top-right-radius: 5px;
		border-bottom-left-radius: 5px;
    background-color: rgba(0, 0, 0, 0.5);
  }
</style>