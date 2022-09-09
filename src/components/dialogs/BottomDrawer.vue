<template>
  <div id="bottom-drawer">
    <v-dialog
      content-class="upload-dialog" transition="dialog-bottom-transition"
      :value="show" eager @click:outside="$emit('click:outside')"
      hide-overlay
    >
      <div class="app-card-body">
        <slot name="header" />
      </div>
      <div class="app-card-body body">
        <ScrollablePanel v-if="scrollable">
          <slot name="body" />
        </ScrollablePanel>
        <slot v-else name="body" />
      </div>
      <div class="app-card-body">
        <slot name="footer" />
      </div>
    </v-dialog>
  </div>
</template>

<script lang="ts">
import { defineComponent } from "@vue/composition-api";
import ScrollablePanel from "@general/ScrollablePanel.vue";
export default defineComponent({
  components: {
    ScrollablePanel
  },
  props: {
    show: {
      type: Boolean,
      required: true
    },
    scrollable: {
      type: Boolean,
      required: false,
      default: true
    }
  }
});
</script>
<style>
.upload-dialog {
  transform-origin: center center;
  max-width: 650px;
  max-height: 70vh;
  margin:0;
  position: absolute;
  right: 90px;
  bottom: 0;
  overflow-y: hidden;
  overflow-x: hidden;
}
@media only screen and (max-width: 850px) {
  .upload-dialog {
    max-width: calc(100vw - 225px);
  }
}
</style>
<style scoped>
.body{
  max-height: 50vh;
  padding: 4px;
  padding-right: 5px;
  padding-left: 7px;
}
</style>