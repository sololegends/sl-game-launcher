<template>
  <div class="v-data-footer">
    <slot name="footer-left" />
    <div class="v-data-footer__select">
      Rows per page:
      <v-select
        hide-details
        :items="items_per_page_options"
        v-model="model_items_per_page"
        :value="value"
        @change="changedSelection"
      />
    </div>
    <div class="v-data-footer__pagination">
      <span class="page-start">{{ pageStart + 1 }}</span>
      -
      <span class="page-stop">{{ pageStop }}</span>
      of
      <span class="page-total">{{ itemsLength }}</span>
    </div>
    <div class="v-data-footer__icons-before" v-if="show_first_last">
      <v-btn
        tip-title="First" icon
        :disabled="pageStart === 0 || lock" @click="$emit('first')"
      >
        <fa-icon icon="step-backward" size="xl" />
      </v-btn>
    </div>
    <div class="v-data-footer__icons-before">
      <v-btn
        tip-title="Previous" icon
        :disabled="pageStart === 0 || lock"
        @click="$emit('previous')"
      >
        <fa-icon icon="chevron-left" size="xl" />
      </v-btn>
    </div>
    <div class="v-data-footer__icons-after">
      <v-btn
        tip-title="Next" icon
        :disabled="pageStop === itemsLength || lock"
        @click="$emit('next')"
      >
        <fa-icon icon="chevron-right" size="xl" />
      </v-btn>
    </div>
    <div class="v-data-footer__icons-after" v-if="show_first_last">
      <v-btn
        tip-title="Last"
        icon :disabled="pageStop === itemsLength || lock"
        @click="$emit('last')"
      >
        <fa-icon icon="step-forward" size="xl" />
      </v-btn>
    </div>
  </div>
</template>

<script lang="ts">
import { defineComponent } from "@vue/composition-api";

export default defineComponent({
  props: {
    items_per_page_options: {
      type: Array,
      required: false,
      default: () => {
        return [ 5, 10, 25, 50, 100 ];
      }
    },
    value: {},
    lock: {
      type: Boolean,
      required: false,
      default: false
    },
    pageStart: {
      type: Number,
      required: false,
      default: 0
    },
    pageStop: {
      type: Number,
      required: false,
      default: 0
    },
    itemsLength: {
      type: Number,
      required: false,
      default: 0
    },
    show_first_last: {
      type: Boolean,
      required: false,
      default: false
    }
  },
  data(){
    return {
      model_items_per_page: this.value
    };
  },
  methods: {
    changedSelection(){
      this.$emit("input", this.model_items_per_page);
    }
  }
});
</script>

<style>
</style>