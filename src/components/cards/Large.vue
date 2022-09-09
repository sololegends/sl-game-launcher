<template>
  <div class="large">
    <v-card class="app-card-body">
      <v-card-title class="app-card-head">
        <div class="title-container">
          <div class="text-h5 no-sel card-title">{{ title }}</div>
          <div class="actions no-sel"><slot name="search"></slot></div>
          <div class="actions no-sel"><slot name="buttons"></slot></div>
        </div>
      </v-card-title>
      <slot name="body">

      </slot>
    </v-card>
  </div>
</template>

<script lang="ts">
import { defineComponent } from "@vue/composition-api";
export default defineComponent({
  name: "LargeCard",
  props: {
    title: {
      type: String,
      default: "Header",
      required: false
    }
  }
});
</script>

<style scoped>
  .v-card {
    width: 99.5%;
    margin: 4px;
    display: inline-block;
    max-height: unset;
  }

  .v-card__title {
    display: inline-block;
    margin-top: 0;
    width: 100%;
    /* height: 70px; */
    padding: 5px 10px;
    position: relative;
  }

  .title-container{
    display: flex;
    flex-wrap: wrap;
    width: 100%;
    max-width: 100%;
  }

  .card-title{
    vertical-align: middle;
    line-height: 60px;
    white-space: nowrap;
    flex-grow: 1;
  }

  .large {
    align-items: center;
    padding: 5px;
    width:100%;
  }

  .actions{
    line-height: 60px;
    white-space: nowrap;
  }
</style>
<style>
  .actions .v-input{
    margin-right: 15px;
    display: inline-block;
  }
  .actions .v-input.v-input--dense{
    padding-top: 12px;
  }
</style>