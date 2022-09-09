<template>
  <base-modal
    :id="id" :title="title" :light_header="true"
    :modal_width="400" :action="action" :closeable="true"
    @closed="closed()"
  >
    <v-form @submit.prevent="() =>{}" ref="form" v-model="form_valid" @input="formInput">
      <div style="padding: 0px 10px">
        Any filters applied on the data behind this will be applied to the export.
        <v-switch
          v-model="all_records"
          id="all_records_switch"
          style="margin-left:5px"
          :label="'Export Limiter - ' + (all_records ? 'Unlimited' : 'Limited')"
          @click="items_per_page=(all_records?null:100)"
        />
        <v-text-field
          :disabled="all_records"
          v-model="items_per_page"
          :rules="all_records?[]:[$rules.required]"
          type="number" :label="all_records?'Unlimited Records':'Number of Records'"
        />
        <v-select
          v-model="export_format"
          :items="export_formats"
          :rules="[$rules.required]"
          label="Export Format"
        />
        <v-switch
          v-model="export_compress"
          id="compression_switch"
          style="margin-left:5px"
          :label="'Compress Output - ' + (export_compress ? 'Compressed' : 'Raw Data')"
        />
        <div v-for="field, key in custom_fields" :key="key">
          <DateRangePicker
            v-if="field.type=='date_range'"
            v-model="custom_vars[key]"
            :name="field.name"
            id='date_range_export'
          />
        </div>
      </div>
    </v-form>
  </base-modal>
</template>

<script lang="ts">
import { defineComponent, ref } from "@vue/composition-api";
import BaseModal from "@modals/BaseModal.vue";
import {BaseModalN} from  "base_modal";
import DateRangePicker from "@components/inputs/DateRangePicker.vue";
import { SomeMap } from "@/shims-app";
import { Vuetify } from "@/plugins/vuetify/vuetify";

export default defineComponent({
  setup(){
    const form = ref<Vuetify.VForm>();
    return {
      form
    };
  },
  name: "ExportDataModal",
  components: {
    BaseModal,
    DateRangePicker
  },
  props: {
    id: {
      type: String,
      required: false,
      default: "export_data"
    },
    title: {
      type: String,
      required: false,
      default: "Export Data"
    },
    count_name: {
      type: String,
      required: false,
      default: "items_per_page"
    },
    data_url: {
      type: String,
      required: true
    },
    url_params: {
      type: Object,
      required: true
    },
    custom_fields: {
      type: Object,
      required: false
    }
  },
  data(){
    return{
      form_valid: false,
      custom_vars: {} as SomeMap,
      all_records: false,
      export_formats: [
        {value: "csv",  text: "CSV"},
        {value: "html", text: "HTML"},
        {value: "json", text: "JSON"}
      ],
      export_format: "csv",
      export_compress: false,
      items_per_page: 100 as number | null
    };
  },
  computed: {
    action(): BaseModalN.ActionItem[]{
      return [
        {
          text: "Download",
          action: this.openExportURL,
          loading: false,
          disabled: true
        } as BaseModalN.ActionItem
      ];
    },
    url(): string{
      return this.$api_root + this.data_url + this.urlParams();
    }
  },
  methods: {
    formInput(){
      this.action[0].disabled = !this.form_valid;
    },
    openExportURL(): void{
      window.open(this.url, "_blank");
    },
    localParams(): SomeMap{
      const data = {
        export: true,
        export_format: this.export_format,
        export_compress: this.export_compress,
        token: this.$store.getters.token
      } as SomeMap;
      data[this.count_name] = this.all_records ? 2147483647 : this.items_per_page;
      for(const key in this.custom_vars){
        if(this.custom_vars[key] !== null){
          data[key] = this.custom_vars[key];
        }
      }
      return data;
    },
    urlParams(): string{
      let data = "";
      let first = true;
      const total_params = {
        ... this.url_params,
        ... this.localParams()
      };
      // Passed data
      for(const key in total_params){
        if(first){
          data += "?";
          data += this.encodeURIVar(key, total_params[key]);
          first = false;
          continue;
        }
        data += "&";
        data += this.encodeURIVar(key, total_params[key]);
      }
      return data;
    },
    closed(): void{
      this.export_format = "csv";
      this.export_compress = false;
      this.items_per_page = 100;
      this.form_valid = true;
      this.all_records = false;
      (this.$refs.form as Vuetify.VForm).resetValidation();
    },
    encodeURIVar(key: string, val: string[] | string | number | boolean){
      if(Array.isArray(val)){
        let results = "";
        for(let i = 0 ; i < val.length; i++){
          results += key + "[]=" + encodeURIComponent(val[i]);
          if(i < val.length - 1){
            results += "&";
          }
        }
        return results;
      }
      return key + "=" + encodeURIComponent(val);
    }
  },
  beforeMount(){
    for(const key in this.custom_fields){
      switch (this.custom_fields[key].type){
      case "date_range":
        this.custom_vars[key] = [];
        break;
      default: break;
      }
    }
  }
});
</script>

<style scoped>

</style>