<template>
  <v-dialog v-model="show_dialog" fullscreen hide-overlay transition="dialog-bottom-transition">
    <template v-slot:activator="{ on, attrs }">
      <v-btn color="primary" dark v-bind="attrs" v-on="on">
        {{activator_text}}
      </v-btn>
    </template>
    <v-card>
      <v-toolbar dark color="primary">
        <v-btn icon dark @click="show_dialog = false">
          <fa-icon icon="times" size="2x" tip-title="Close Window" />
        </v-btn>
        <v-toolbar-title>{{title}}</v-toolbar-title>
        <v-spacer></v-spacer>
        <v-btn class="secondary" v-if="saveable" @click="$fn.save(saveable_filename, text, saveable_filetype)">
          Save Data
        </v-btn>
      </v-toolbar>
      <ScrollablePanel style="height:calc(100vh - 75px)">
        <pre style="white-space:pre-line;padding:10px;">{{text}}</pre>
      </ScrollablePanel>
    </v-card>
  </v-dialog>
</template>

<script lang="ts">
import { defineComponent } from "@vue/composition-api";
import ScrollablePanel from "@general/ScrollablePanel.vue";
export default defineComponent({
  name: "FullViewDialog",
  components: { ScrollablePanel },
  props: {
    title: {
      type: String,
      required: true
    },
    text: {
      type: String,
      required: true
    },
    activator_text: {
      type: String,
      required: true
    },
    saveable: {
      type: Boolean,
      required: false,
      default: false
    },
    saveable_filename: {
      type: String,
      required: false,
      default: "raw_data.txt"
    },
    saveable_filetype: {
      type: String,
      required: false,
      default: "text/plain"
    }
  },
  data(){
    return {
      show_dialog: false
    };
  }
});
</script>