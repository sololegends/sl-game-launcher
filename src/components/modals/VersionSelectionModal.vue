<template>
  <base-modal
    :id="id" :title="title" :light_header="true"
    modal_width="unset" :action="action" :closeable="true"
    @closed="closed()" @before-open="beforeOpen" no_margin
  >
    <v-list shaped>
      <v-list-item
        @click="installVersion('latest', latest_game_obj, $event)"
        :class="'dlc-item' + (isCurrentVersion?' present':'')"
      >
        <v-list-item-avatar>
          <v-avatar color="primary" size="36">L</v-avatar>
        </v-list-item-avatar>

        <v-list-item-content>
          <v-list-item-title>latest ({{ gameVersion }})</v-list-item-title>
          <v-list-item-subtitle>{{gameSlug}}</v-list-item-subtitle>
        </v-list-item-content>

        <v-list-item-action>
          <fa-icon
            v-if="!isCurrentVersion"
            tip-title="Switch to Latest Version"
            icon="download" size="xl"
          />
        </v-list-item-action>
      </v-list-item>
      <v-list-item
        v-for="(index) of version_keys" :key="index"
        @click="installVersion(index, versions[index], $event)"
        :class="'dlc-item' + (index === currentVersion?' present':'')"
      >
        <v-list-item-avatar>
          <v-avatar color="primary" size="36">
            V
          </v-avatar>
        </v-list-item-avatar>

        <v-list-item-content>
          <v-list-item-title>
            {{index}}
          </v-list-item-title>
          <v-list-item-subtitle>{{gameSlug}}</v-list-item-subtitle>
        </v-list-item-content>

        <v-list-item-action>
          <fa-icon
            v-if="index !== currentVersion"
            :tip-title="versions[index].present?'':'Switch to Version'"
            :icon="versions[index].present?'':'download'"
            size="xl"
          />
        </v-list-item-action>
      </v-list-item>
    </v-list>
  </base-modal>
</template>

<script lang="ts">
import BaseModal from "@modals/BaseModal.vue";
import {BaseModalN} from  "base_modal";
import { defineComponent } from "@vue/composition-api";
import filters from "@/js/filters";
import { GOG } from "@/types/gog/game_info";
import {ipcRenderer as ipc} from "electron";

interface VersionsParams extends BaseModalN.Params{
  params: {
    versions: Record<string, GOG.RemoteGameDLC>
    game: GOG.GameInfo
    game_slug: string
  }
}

export default defineComponent({
  name: "VersionSelectionModal",
  components: {
    BaseModal
  },
  props: {
    id: {
      type: String,
      required: false,
      default: "versions_viewer"
    },
    title: {
      type: String,
      required: false,
      default: "Alternate Versions"
    }
  },
  data(){
    return{
      versions: {} as Record<string, GOG.RemoteGameDLC>,
      version_keys: {} as string[],
      game: {} as GOG.GameInfo | undefined,
      game_slug: "",
      latest_game_obj: {

      } as GOG.RemoteGameDLC
    };
  },
  computed: {
    isCurrentVersion(): boolean{
      return this.game?.current_version !== undefined
        && this.game.current_version === this.game.remote?.version ? true : false;
    },
    currentVersion(): string{
      return this.game?.current_version || "";
    },
    action(): BaseModalN.ActionItem[]{
      return [
      ];
    },
    gameSlug(): string | number{
      return filters.procKey(this.game_slug);
    },
    gameVersion(): string{
      return this.game?.remote?.version === undefined ? "Unknown" : this.game.remote.version;
    }
  },
  methods: {
    installVersion(version_id: string, version: GOG.RemoteGameDLC, e: MouseEvent){
      if(version_id === "latest"){
        ipc.send("reinstall-game", this.game);
        this.$modal.hide(this.id);
        return;
      }
      if(e.shiftKey){
        ipc.send("download-version", this.game, version_id, version);
        this.$modal.hide(this.id);
        return;
      }
      ipc.send("install-version", this.game, version_id, version);
      this.$modal.hide(this.id);
    },
    closed(): void{
      this.version_keys = [];
      this.versions = {};
      this.game = undefined;
      this.game_slug = "";
    },
    beforeOpen(e: VersionsParams){
      console.log(e.params);
      this.versions = e.params.versions;
      this.version_keys = Object.keys(e.params.versions).sort((a: string, b: string) =>{
        return b.localeCompare(a);
      });
      this.game = e.params.game;
      this.game_slug = e.params.game_slug;
    },
    procKey(item: string): string | number{
      item = item.replace(this.game_slug, "");
      return filters.procKey(item);
    }
  }
});
</script>

<style scoped>
.present{
  background-color: var(--v-success-bkg-base);
}
.dlc-item{
  border-bottom:1px solid var(--v-app-stat-border-base);
}
</style>