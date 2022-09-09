<template>
  <div class="text-subtitle-2 no-data" v-if="filterHeaders.length === 0">
    <slot name="no-data">No Hidden Data</slot>
  </div>
  <v-simple-table v-else dense>
    <template v-slot:default>
      <tbody>
        <tr v-for="header in filterHeaders" :key="header.value">
          <td class="key no-wrap text-subtitle-2">{{ header.text }}</td>
          <td class="no-wrap text-subtitle-2" style="width:10px;padding:0;">:</td>
          <td class="value">
            <slot :name="`item.${header.value}`" :item="item">
              {{item[header.value]}}
            </slot>
          </td>
        </tr>
      </tbody>
    </template>
  </v-simple-table>
</template>
<script lang="ts">
import { defineComponent } from "@vue/composition-api";
import { Vuetify } from "@/plugins/vuetify/vuetify";

export type UnknownItem = {
  [key: string]: unknown
}

export default defineComponent({
  name: "DataTableCollapsed",
  slots: {

  },
  props: {
    headers: {
      type: Array as () => Vuetify.Column[],
      required: true
    },
    item: {
      type: Object as () => UnknownItem,
      required: true
    }
  },
  computed: {
    filterHeaders(): Vuetify.Column[]{
      const headers = [];
      for(const i in this.headers){
        const header = this.headers[i];
        if(header.disabled === undefined || header.disabled === false ||
					this.item[header.value] === undefined || this.item[header.value] === "" || header.text === ""){
          continue;
        }
        headers.push(header);
      }
      return headers;
    }
  },
  methods: {
    calcWidths(): void{
      this.widths = Array.from(this.$el.querySelectorAll("th")).map(e => e.clientWidth);
    }
  }
});
</script>

<style scoped>
.value{
	width:99%;
}
.no-data{
	width:100%;
	padding-left:15px;
	text-align: left;
}
</style>