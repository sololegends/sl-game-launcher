<template>
  <base-modal
    :id="id" :title="title" :light_header="true"
    modal_width="unset" :action="action" :closeable="true"
    @closed="closed()" @before-open="beforeOpen" no_margin
  >
    <v-list>
      <v-list-item
        v-for="(item, index) in launch_options" :key="index"
        @click="game && game.is_installed? useLaunchOption(item) : undefined"
        :class="'launch-item'"
      >
        <v-list-item-avatar width="50">
          <v-chip dense color="primary">
            <fa-icon
              style="height:20px"
              :icon="item.isPrimary?'play':(item.category === 'RESET' ? 'trash-alt' : 'plus')"
              size="xs"
            />
          </v-chip>
        </v-list-item-avatar>

        <v-list-item-content>
          <v-list-item-title>
            {{item.name ? procKey(item.name) : "Launch Game"}}
          </v-list-item-title>
          <v-list-item-subtitle>{{item.path || item.link}}</v-list-item-subtitle>
        </v-list-item-content>

      </v-list-item>
    </v-list>

    <v-checkbox slot="actions-left" v-model="dont_ask_again" label="Don't ask again" />
  </base-modal>
</template>

<script lang="ts">
import BaseModal from "@modals/BaseModal.vue";
import {BaseModalN} from  "base_modal";
import { defineComponent } from "@vue/composition-api";
import filters from "@/js/filters";
import { GOG } from "@/types/gog/game_info";
import {ipcRenderer as ipc} from "electron";

export default defineComponent({
  name: "LaunchOptionsModal",
  components: {
    BaseModal
  },
  props: {
    id: {
      type: String,
      required: false,
      default: "launch_options"
    },
    title: {
      type: String,
      required: false,
      default: "Launch Options"
    }
  },
  data(){
    return{
      resolve: function(){ return undefined; } as (value: GOG.PlayTasks | undefined) => void,
      reject: function(){ return undefined; } as (value: GOG.PlayTasks | undefined) => void,
      launch_options: [] as GOG.PlayTasks[],
      game: {} as GOG.GameInfo | undefined,
      resolved: false,
      dont_ask_again: false
    };
  },
  computed: {
    action(): BaseModalN.ActionItem[]{
      return [
        {
          text: "Cancel",
          action: this.cancel
        }
      ];
    }
  },
  methods: {
    playTaskID(task: GOG.PlayTasks){
      return task.path + ":" + task.type + ":" + task.arguments + ":" + task.isPrimary + ":" + task.link;
    },
    useLaunchOption(play_task: GOG.PlayTasks){
      if(this.dont_ask_again && play_task.category === "game"){
        // Save for loading later
        ipc.invoke("save-default-playtask", this.game?.name, this.playTaskID(play_task));
      }

      if(play_task.category === "RESET"){
        ipc.invoke("save-default-playtask", this.game?.name, "none");
      } else {
        this.resolve(play_task);
      }
      this.resolved = true;
      this.$modal.hide(this.id);
    },
    cancel(){
      this.reject(undefined);
      this.$modal.hide(this.id);
    },
    async open(tasks: GOG.PlayTasks[], game: GOG.GameInfo, force = false, primary_only = false): Promise<GOG.PlayTasks | undefined>{
      this.launch_options = tasks;
      if(primary_only){
        this.launch_options = this.launch_options.filter(ele => ele.isPrimary === true || ele.category === "game");
      }
      this.game = game;
      if(tasks.length === 1){
        // Return and resolve immediately
        return new Promise((resolve) => {
          resolve(tasks[0]);
        });
      }
      if(force){
        this.launch_options.push({
          name: "Reset Remembered Launch",
          path: "This will make the launcher ask each launch again",
          category: "RESET",
          isPrimary: false,
          languages: [],
          type: "internal"
        });
      }
      // Check if there is already a task that is supposed to be loaded by default
      if(!force){
        const default_task = await ipc.invoke("load-default-playtask", game.name);
        if(default_task){
          for(const task of tasks){
            if(default_task === this.playTaskID(task)){
              // Return and resolve immediately
              return new Promise((resolve) => {
                resolve(task);
              });
            }
          }
        }
      }
      this.launch_options.sort(function(a, b){
        if (!a.isPrimary && b.isPrimary){
          return 1;
        }
        if (a.isPrimary && !b.isPrimary){
          return -1;
        }
        return 0;
      });

      this.$modal.show(this.id);
      return new Promise((resolve, reject) => {
        this.resolve = resolve;
        this.reject = reject;
      });
    },
    closed(): void{
      this.dlc = [];
      this.game = undefined;
      this.game_slug = "";
      if(!this.resolved){
        this.reject(undefined);
      }
      this.resolved = false;
      this.dont_ask_again = false;
    },
    beforeOpen(){
      // Nothing here
    },
    procKey: filters.procKey
  }
});
</script>

<style scoped>
.present{
  background-color: var(--v-success-bkg-base);
}
.launch-item{
  border-bottom:1px solid var(--v-app-stat-border-base);
}
</style>