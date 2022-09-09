<template>
  <v-menu
    v-if="show_activator"
    transition="slide-x-transition" bottom right
    class="primary" :nudge-top="top? BASE_H + (ITEM_H * filteredItems.length) : 0"
    offset-y
  >
    <template v-slot:activator="{ on, attrs, value }">
      <v-btn class="primary actions-menu-activator" v-bind="attrs" v-on="on">
        Actions
        <fa-icon style="margin-left:10px" :icon="value?'caret-up':'caret-down'" size="lg" />
      </v-btn>
    </template>
    <v-card class="actions-menu-selection" max-width="200" tile>
      <v-list dense>
        <v-subheader>{{title}} Actions</v-subheader>
        <v-list-item
          v-for="(item, i) in filteredItems" :key="i"
          @click="item.action" :action="convertToSlug(dynamicString(item.text))"
          :disabled="dynamicProp(item.disabled)"
        >
          <v-list-item-icon class="icon-list-margin">
            <fa-icon :icon="item.icon" :color="item.disabled?'grey':item.color" class="v-icon v-icon" />
          </v-list-item-icon>
          <v-list-item-content>
            <v-list-item-title>{{dynamicString(item.text)}}</v-list-item-title>
          </v-list-item-content>
        </v-list-item>
      </v-list>
    </v-card>
  </v-menu>
</template>

<script lang="ts">
import { ActionsMenu } from "@/shims-app";
import { defineComponent } from "@vue/composition-api";

export default defineComponent({
  props: {
    items: {
      type: Array as () => Array<ActionsMenu.ActionItem>,
      required: true
    },
    title: {
      type: String,
      required: false,
      default: ""
    },
    top: {
      type: Boolean,
      required: false,
      default: true
    },
    show_activator: {
      type: Boolean,
      required: false,
      default: true
    }
  },
  data(){
    return {
      BASE_H: 92,
      ITEM_H: 40
    };
  },
  computed: {
    filteredItems(): Array<ActionsMenu.ActionItem>{
      const filtered = [] as  Array<ActionsMenu.ActionItem>;
      for(const i in this.items){
        const item = this.items[i];
        if(this.dynamicBoolean(item.hidden, false)){
          continue;
        }
        filtered.push(item);
      }
      return filtered;
    }
  },
  methods: {
    convertToSlug(text: string): string{
      return text.toLowerCase().replaceAll(" ", "-");
    }
  }
});
</script>

<style scoped>

</style>