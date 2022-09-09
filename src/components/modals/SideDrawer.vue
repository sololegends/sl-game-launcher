<template>
  <div id="side-notify">
    <v-dialog
      content-class="notify-dialog" transition="scroll-x-reverse-transition" max-width="400"
      scrollable :value="show" eager
      @click:outside="$emit('click:outside')"
    >
      <v-card class="flex">
        <v-card-title class="primary header" style="padding: 8px 24px 8px;">
          <div class="text-h5 white--text">{{name}}</div>
        </v-card-title>
        <v-divider></v-divider>
        <ScrollablePanel  class="side-body">
          <slot name="body" />
        </ScrollablePanel>
        <div class="side-footer">
          <slot name="footer" />
        </div>
      </v-card>
    </v-dialog>
  </div>
</template>

<script lang="ts">
import { defineComponent } from "@vue/composition-api";
import ScrollablePanel from "@components/general/ScrollablePanel.vue";

export default defineComponent({
  props: {
    show: {
      type: Boolean,
      required: true
    },
    name: {
      type: String,
      required: true
    }
  },
  data(){
    return {
      timer: null,
      alert_stack: {},
      alert_count: 0,
      max_id: 0,
      loading: false
    };
  },
  components: { ScrollablePanel }
});
</script>

<style>
  .notify-dialog {
    transform-origin: center center;
    max-width: 400px;
    min-height: 100%;
    margin:0;
    margin-top: 0px;
    position: absolute;
    right: 0;
    transition: width .5s
  }
  .bell-notifications-container{
    margin-top:10px;
  }
</style>
<style scoped>
  .v-sheet.v-card{
    height: 100%;
  }
  .v-dialog > * {
    width: 100%;
    min-height: 98.4vh;
  }
  .header{
    box-shadow: 0px 2px 4px -1px rgb(0 0 0 / 20%), 0px 4px 5px 0px rgb(0 0 0 / 14%), 0px 1px 10px 0px rgb(0 0 0 / 12%);
  }
  .flex{
    display: flex;
    position: absolute;
  }
  .side-body{
    flex-grow: 1;
  }
</style>