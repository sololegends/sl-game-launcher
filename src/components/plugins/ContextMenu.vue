<template>
  <v-menu
    v-model="show_menu"
    :position-x="value.x"
    :position-y="value.y"
    absolute
    offset-y
  >
    <v-list>
      <v-list-item
        v-for="(item, index) in items"
        :key="index"
        @click="item.click"
        class="flex"
      >
        <fa-icon v-if="item.icon !== undefined" class="icon" :icon="item.icon" />
        <span>{{ item.title }}</span>
      </v-list-item>
    </v-list>
  </v-menu>
</template>

<script lang="ts">
import { ContextMenu } from "./context-menu/context-menu";
import { defineComponent } from "@vue/composition-api";

export default defineComponent({
  props: {
    items: {
      type: Array as () => ContextMenu.MenuItem[],
      required: true
    },
    value: {
      type: Object as () => ContextMenu.Bind,
      required: true
    }
  },
  data(){
    return {
      show_menu: this.value.show
    };
  },
  watch: {
    "value": {
      handler: function(){
        if(this.value.show){
          this.open();
          return;
        }
        this.close();
      },
      deep: true
    },
    "show_menu": function(){
      const new_val = {...this.value};
      new_val.show = this.show_menu;
      this.$emit("input", new_val);
    }
  },
  methods: {
    open(){
      this.$context_int.closeAll();
      this.show_menu = true;
    },
    close(): void{
      this.show_menu = false;
    }
  },
  beforeMount(): void{
    this.$context_int._cont.$on("close", () => {
      this.close();
    });
  },
  beforeDestroy(): void{
    this.$context_int._cont.$off("close", this.close);
  }
});
</script>

<style scoped>
.icon{
	margin-right:10px;
	width: 15px;
	margin-top: -3px;
}
</style>