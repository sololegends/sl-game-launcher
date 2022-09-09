<template>
  <div v-if="isArray">
    <ul v-for="(v, i) in data" :key="'key_'+i">
      <li><code>{{v}}</code></li>
    </ul>
  </div>
  <code v-else-if="isObject">
    Object of {{Object.keys(data).length}} key{{plural(Object.keys(data).length)}}
    <fa-icon icon="eye" :tip-title="buildMapTipTitle(data)"></fa-icon>
  </code>
  <div :tip-title="data+'\nCheckbox is read only'" v-else-if="isBoolean" class="checkbox">
    <fa-icon
      :color="asBool ? 'primary' : ''"
      :icon="asBool ? 'check-square' : ['far','square']"
      :size="small ? 'sm' : 'lg'" style="margin-left: 5px"
    /> {{data}}
  </div>
  <div v-else-if="isNull">
    None
  </div>
  <div v-else-if="isCredential">
    <v-chip
      v-if="data != -1"
      tip-title="Link to credential page"
      class="primary text-decoration-underline white--text" :small="!small" :x-small="small"
      @click="() => {$router.push('/credentials/#name:' + data.substring(2, data.length - 1))}"
    >
      {{data.substring(2, data.length - 1)}}
      <fa-icon icon="key" :size="small ? 'sm' : 'lg'" style="margin-left: 5px" />
    </v-chip>
    <span v-else>None</span>
  </div>
  <a
    target="_blank" v-else-if="typeof(data) === 'string' && data.startsWith('APP_IL>>')"
    :href="urlEncode(data.replace('APP_IL>>', '').replace('{#TOKEN}', getToken()))"
  >
    {{lastIndexOf(data, "/")}}
  </a>
  <code v-else>
    {{data}}
  </code>
</template>

<script lang="ts">
import generic_data_mixin from "./mixins/generic_data.mixin";
import IconChip from "@inserts/IconChip.vue";
import mixin from "@mixins/index";

export default mixin(generic_data_mixin).extend({
  components: {
    IconChip
  },
  mixins: [generic_data_mixin]
});
</script>

<style scoped>
.checkbox{
	display:inline-block;
}
</style>