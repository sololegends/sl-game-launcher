<template>
  <base-modal
    :id="id" :title="getTitle" :light_header="true"
    :modal_width="isArray?400:500" :action="action" :closeable="true"
    @before-open="beforeOpen"
    @closed="closed()"
  >
    <!-- End Special cases -->
    <div v-if="Array.isArray(details)">
      <ul v-for="v in details" :key="'key_'+(typeof(v) === 'object' ? JSON.stringify(v) : v)">
        <li><code>{{v}}</code></li>
      </ul>
    </div>
    <table v-else-if="details != null && typeof(details) === 'object'">
      <tr v-for="(val, key) in filteredDetailsMap" :key="key">
        <td class="key">{{keyFilter(key)}}</td>
        <td class="colon">:</td>
        <td class="value">
          <GenericData :data="val" />
        </td>
      </tr>
    </table>
    <div v-else>
      {{details}}
    </div>
  </base-modal>
</template>

<script lang="ts">
import { SomeArray, SomeMap } from "@/shims-app";
import BaseModal from "@modals/BaseModal.vue";
import { defineComponent } from "@vue/composition-api";
import { DetailsModalN } from "base_modal_ext";
import filter from "@filters";
import GenericData from "@inserts/GenericData.vue";

export default defineComponent({
  components: {
    BaseModal,
    GenericData
  },
  props: {
    title: {
      type: String,
      required: false,
      default: "Details"
    },
    id: {
      type: String,
      required: false,
      default: "details_modal"
    }
  },

  data(){
    return {
      action: [],
      details: {},
      overwrite_title: "",
      enabled_data: false
    };
  },
  computed: {
    getTitle(): string | boolean{
      return this.overwrite_title !== "" ? this.overwrite_title : this.title;
    },
    isArray(): boolean{
      return Array.isArray(this.details);
    },
    filteredDetails(): SomeMap | SomeArray{
      if(this.isArray){
        return this.details;
      }
      const data_tmp = this.details as SomeMap;
      const tmp = {}  as SomeMap;
      for(const key in this.details){
        if(data_tmp[key] !== undefined && ![ "details", "delete", "edit" ].includes(key)){
          tmp[key] = data_tmp[key];
        }
      }
      return tmp;
    },
    filteredDetailsMap(): SomeMap{
      const tmp = this.filteredDetails;
      if(Array.isArray(tmp)){
        return {} as SomeMap;
      }
      return tmp;
    },
    filteredDetailsArray(): SomeArray{
      const tmp = this.filteredDetails;
      if(Array.isArray(tmp)){
        return tmp as SomeArray;
      }
      return [] as SomeArray;
    }
  },
  methods: {
    urlEncode(val: string): string{
      val = encodeURI(val);
      const start = val.substring(0, val.lastIndexOf("/"));
      const tail = val.substring(val.lastIndexOf("/") + 1);
      return start + "/" + encodeURIComponent(tail);
    },
    getToken(){
      return this.$store.getters.token.replaceAll("=", "-").replaceAll("/", "_");
    },
    beforeOpen(e: DetailsModalN.Params){
      this.details = e.params.details;
      this.overwrite_title = "";
      if(e.params.enabled_data !== undefined){
        this.enabled_data = e.params.enabled_data;
      }
      if(e.params.title !== undefined){
        this.overwrite_title = e.params.title;
      }
    },
    closed(){
      this.details = {};
      this.overwrite_title = "";
      this.enabled_data = false;
    },
    buildMapTipTitle(map: SomeMap): string{
      let str = "Object Data:";
      for(const key in map){
        str += "\n" + key + ": " + map[key];
      }
      return str;
    },
    keyFilter: filter.procKey
  }
});
</script>

<style scoped>
  .array-title{
    border-bottom:1px solid var(--v-app-details-border-base);
    margin-top:5px;
  }
  .version{
    margin-left:5px;
    white-space:nowrap;
  }
  .version::before{
    content:"- ";
  }
  .status{
    float:right;
    border-radius: 7px;
    padding:0px 7px;
    font-weight:bold;
  }
  table{
    width:100%;
    border-collapse: collapse;
  }
  .key{
    font-weight:bold;
    white-space: nowrap;
  }
  .colon{
    width:15px;
  }
  code{
    word-break: break-all;
  }
  td{
    border-bottom:1px solid var(--v-app-details-border-base);
  }
</style>