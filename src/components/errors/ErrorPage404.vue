<template>
  <div class="centered-container">
    <div class="text-h3">Page not Found</div>
    <router-link :to="{ name: 'Games' }" tag="v-btn" class="primary">Go to Games List</router-link>
  </div>
</template>

<script lang="ts">
import { defineComponent } from "@vue/composition-api";

export default defineComponent({

});
</script>

<style scoped>
.text-h3{
	margin-bottom: 20px;
}
.centered-container{
	flex-direction: column;
}
</style>