<template>
  <base-modal
    :id="id" :title="title" :light_header="true"
    modal_width="unset" :action="action" :closeable="true"
    @closed="closed()" @before-open="beforeOpen" no_margin
  >
    <v-list shaped>
      <v-list-item
        v-for="(item, index) in dlc" :key="index"
        @click="game && game.is_installed? installDLC(item, $event) : undefined"
        :class="'dlc-item' + (item.present?' present':'')"
      >
        <v-list-item-avatar width="50">
          <v-chip dense color="primary">DLC</v-chip>
        </v-list-item-avatar>

        <v-list-item-content>
          <v-list-item-title>
            {{procKey(item.slug)}}
          </v-list-item-title>
          <v-list-item-subtitle>{{gameSlug}}</v-list-item-subtitle>
        </v-list-item-content>

        <v-list-item-action v-if="game && game.is_installed">
          <fa-icon
            :tip-title="item.present?'Uninstall DLC':'Install DLC'"
            :icon="item.present?'trash-alt':'download'"
            size="xl"
          />
        </v-list-item-action>
        <v-list-item-action v-if="game && game.is_installed && $store.getters.dev_mode && item.present">
          <fa-icon
            tip-title="Rerun Setup Script (Ctrl + Click)"
            icon="cogs"
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

interface DLCParams extends BaseModalN.Params{
  params: {
    dlc: GOG.RemoteGameDLC[]
    game: GOG.GameInfo
    game_slug: string
  }
}

export default defineComponent({
  name: "DLCSelectionModal",
  components: {
    BaseModal
  },
  props: {
    id: {
      type: String,
      required: false,
      default: "dlv_viewer"
    },
    title: {
      type: String,
      required: false,
      default: "Manage DLC"
    }
  },
  data(){
    return{
      dlc: [] as GOG.RemoteGameDLC[],
      game: {} as GOG.GameInfo | undefined,
      game_slug: ""
    };
  },
  computed: {
    action(): BaseModalN.ActionItem[]{
      if(this.game === undefined || !this.game.is_installed){
        return [];
      }
      return [
        {
          text: "Uninstall All",
          action: this.uninstallAll
        },
        {
          text: "Install All",
          action: this.downloadAll
        }
      ];
    },
    gameSlug(): string | number{
      return filters.procKey(this.game_slug);
    }
  },
  methods: {
    runSetupScript(dlc_id: string): void{
      ipc.send("rerun-ins-script", this.game, dlc_id);
    },
    downloadAll(){
      for(const i in this.dlc){
        if(!this.dlc[i].present){
          this.installDLC(this.dlc[i], undefined);
        }
      }
    },
    uninstallAll(){
      for(const i in this.dlc){
        if(this.dlc[i].present){
          this.installDLC(this.dlc[i], undefined);
        }
      }
    },
    installDLC(dlc: GOG.RemoteGameDLC, e?: MouseEvent){
      if(e?.ctrlKey){
        this.runSetupScript(dlc.gameId);
        return;
      }
      if(dlc.present){
        ipc.send("uninstall-dlc", this.game, dlc);
        this.$modal.hide(this.id);
        return;
      }
      if(e?.shiftKey){
        ipc.send("download-dlc", this.game, dlc.slug);
        this.$modal.hide(this.id);
        return;
      }
      ipc.send("install-dlc", this.game, dlc.slug);
      this.$modal.hide(this.id);
    },
    closed(): void{
      this.dlc = [];
      this.game = undefined;
      this.game_slug = "";
    },
    beforeOpen(e: DLCParams){
      console.log(e.params);
      this.dlc = e.params.dlc;
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