<template>
  <v-dialog v-model="show_dialog" fullscreen hide-overlay transition="dialog-bottom-transition">
    <template v-slot:activator="{ on, attrs }">
      <slot name="activator" v-bind:on="on">
        <v-btn color="primary" dark v-bind="attrs" @click="onShow">
          {{activator_text}}
        </v-btn>
      </slot>
    </template>
    <v-card>
      <v-toolbar dark color="primary">
        <v-btn icon dark @click="onHide">
          <fa-icon icon="times" size="2x" tip-title="Close Window" />
        </v-btn>
        <v-toolbar-title>Backend Logs</v-toolbar-title>
        <v-spacer></v-spacer>
      </v-toolbar>
      <ScrollablePanel style="height:calc(100vh - 75px)" v-model="scrollable">
        <div style="padding: 0px 20px">
          <v-select
            :items="['ALL', 'DEBUG', 'LOG', 'WARN', 'ERROR']"
            hint="Show only Above..." persistent-hint
            v-model="show_elements"
          />
        </div>
        <div style="padding:5px;">
          <span v-for="line of text" :key="line">
            <LoggingLine :line="line" v-if="line.trim().length > 0" :show="show_elements" />
          </span>
        </div>
      </ScrollablePanel>
    </v-card>
  </v-dialog>
</template>

<script lang="ts">
import ScrollablePanel, { ScrollData } from "../general/ScrollablePanel.vue";
import { defineComponent } from "@vue/composition-api";
import { ipcRenderer as ipc } from "electron";
import LoggingLine from "../inserts/LoggingLine.vue";

export default defineComponent({
  components: { ScrollablePanel, LoggingLine },
  props: {
    activator_text: {
      type: String,
      required: false,
      default: "Backend Logs"
    }
  },
  data(){
    return {
      show_dialog: false,
      text: [] as string[],
      scrollable: {} as ScrollData,
      show_elements: "ALL"
    };
  },
  computed: {
  },
  methods: {
    async onShow(){
      this.show_dialog = true;
      ipc.send("logging-enable-events");
      ipc.on("logging-event", this.receiveLog);
      this.text = (await ipc.invoke("logging-existing-logs")).split(/[\r\n]+/);
    },
    onHide(){
      this.show_dialog = false;
      ipc.send("logging-disable-events");
      ipc.off("logging-event", this.receiveLog);
    },
    receiveLog(e: unknown, entry: string){
      const atBottom = this.scrollable.atBottom;
      this.text.push(entry?.trim());
      // Scroll to bottom, if already there
      if(atBottom){
        this.scrollable.scrollTop = this.scrollable.scrollTopMax;
      }
    }
  }
});
</script>

<style scoped>
</style>