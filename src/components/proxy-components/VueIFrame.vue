<template>
  <div class="window">
    <iframe :id="toID(title)" :title="title" frameBoarder="0" :src="src">
    </iframe>
  </div>
</template>
<script lang="ts">
import { defineComponent } from "@vue/composition-api";
export default defineComponent({
  name: "VUEIFrame",
  props: {
    src: {
      type: String,
      required: true
    },
    title: {
      type: String,
      required: true
    }
  },
  methods: {
    toID: function(val: string): string{
      return val.replaceAll(" ", "_").toLowerCase() + "_admin_frame";
    }
  }
});
</script>
<style scoped>
.window{
    width: 100%;
  padding: 15px;
  height: 85vh;
}
h1 {text-align: center;}
iframe {
  width: 100%;
  height: 100%;
  border: none;
}
.output {background: #eee;}
</style>
