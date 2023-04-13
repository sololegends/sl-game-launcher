<template>
  <div :class="'logging-line text '+type" v-if="canShow">
    <span class="date">{{ date }}</span>
    >>
    <span :class="'type '+type">{{ type }}</span>
    >>
    <span>{{ text }}</span>
  </div>
</template>

<script lang="ts">
import { defineComponent } from "@vue/composition-api";

export default defineComponent({
  props: {
    line: {
      type: String,
      required: true
    },
    show: {
      type: String,
      required: false,
      default: "ALL"
    }
  },
  data(){
    return {
      date: this.line.split("]")[0] + "]",
      type: this.line.split(">>")[1].trim(),
      text: this.line.split(">>", 3)[2].trim()
    };
  },
  computed: {
    canShow(): boolean{
      if(this.show === "ALL"){
        return true;
      }
      switch(this.show){
      case "LOG": return this.type === "ERROR" || this.type === "WARN" || this.type === "LOG";
      case "WARN": return this.type === "ERROR" || this.type === "WARN";
      case "ERROR": return this.type === "ERROR";
      case "DEBUG":
      case "ALL":
      default: return true;
      }
    }
  },
  methods: {

  }
});
</script>

<style scoped>
.logging-line{
	margin: 0px;
	padding: 0px;
	white-space:pre-line;
	display: pre;
	font-family: monospace;
}
.date{
	font-size: 12px;
	color:#999;
}
.type{
	font-weight: bold;
}
.type.ERROR{
	color: var(--v-error-base);
}
.type.WARN{
	color: var(--v-warning-base);
}

.type.DEBUG{
  color: #666;
}


.text.ERROR{
	color: var(--v-error-base);
}
.text.WARN{
	color: var(--v-warning-base);
}
.text.DEBUG{
  color: #666;
}
</style>