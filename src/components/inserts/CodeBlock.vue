<template>
  <v-sheet elevation="0" class="code-block-sheet">
    <ScrollablePanel max_height="200px">
      <slot />
    </ScrollablePanel>
  </v-sheet>
</template>

<script lang="ts">
import { defineComponent } from "@vue/composition-api";
import ScrollablePanel from "@general/ScrollablePanel.vue";

export default defineComponent({
  components: {
    ScrollablePanel
  },
  props: {
    lang: {
      type: String,
      required: false,
      default: "none"
    }
  }
});
</script>

<style scoped>
	.code-block-sheet{
		background: rgba(255, 255, 255, 0.1);
		border-radius: 3px;
		padding: 0.2em 0.4em;
		white-space: pre;

		font-size: 85%;
		font-weight: normal;
		font-family: monospace, monospace;
	}
</style>