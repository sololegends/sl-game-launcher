<template>
  <code v-if="element.name === 'null'">
    None
  </code>
  <v-chip
    v-else
    :class="'primary subtitle-2' + (link ? ' text-decoration-underline' : '')"
    text-color="white" style="margin:3px" :color="color"
    :tip-title="description"
    @click="routerGo" :small="!small" :x-small="small"
  >
    <EntityIcon :entity="entity" />
    {{textCalc}}
  </v-chip>
</template>

<script lang="ts">
import { defineComponent } from "@vue/composition-api";
import EntityIcon from "@inserts/EntityIcon.vue";

export interface IconChipElement {
  type: "user"
  name: string
  id?: number
}

export default defineComponent({
  name: "IconChip",
  components: { EntityIcon },
  props: {
    element: {
      type: Object as () => IconChipElement,
      required: true
    },
    text: {
      type: String,
      required: false
    },
    description: {
      type: String,
      required: false,
      default: undefined
    },
    color: {
      type: String,
      required: false
    },
    link: {
      type: Boolean,
      required: false,
      default: true
    },
    small: {
      type: Boolean,
      required: false,
      default: false
    }
  },
  data(){
    return {
    };
  },
  methods: {
    routerGo(): void{
      if(this.link === false){ return; }
      this.$router.push(this.routePath);
      // Close all modals
      this.$modal.hide("all");
    }
  },
  computed: {
    entity(): string{
      return this.element.type + ":" + this.element.name;
    },
    routePath(): string{
      switch(this.type){
      case "user": return "/accounts#user:" + this.element.name;
      default: return "";
      }
    },
    textCalc(): string{
      return this.text !== undefined ? this.text : this.element.name;
    },
    type(): string{
      return this.element.type;
    }
  }
});
</script>