<template>
  <base-modal
    :id="id" :title="options.header" persistent
    :light_header="true" :action="action" :closeable='true'
    :modal_width='450' @before-open="beforeOpen" @closed="closed"
    :show_cancel="false"
  >
    <div class="confirm-title">{{title}}</div>
    <br  v-if="options.header">
    <div class="message">
      <span class="text-subtitle-2">{{message}} </span>
    </div>
    <v-form @submit.prevent="submitted" v-model="form_valid" ref="form" @input="formInput">
      <v-text-field
        autofocus v-model="input"
        :placeholder="options.placeholder"
        :type="options.type"
        :counter="options.input_max !== null || options.input_min !== null"
        :maxlength="options.input_max"
        :minlength="options.input_min"
        :rules="(options.input_max || options.input_min)?[$rules.lengthMinMax(inputMin, inputMax), ...options.rules]:[...options.rules]"
      />
    </v-form>
  </base-modal>
</template>

<script lang="ts">
import { defineComponent, ref } from "@vue/composition-api";
import BaseModal from "@modals/BaseModal.vue";
import {BaseModalN} from "base_modal";
import { GeneralPopup } from "confirmation_modal";
import { Vuetify } from "@/plugins/vuetify/vuetify";

export default defineComponent({
  setup(){
    const form = ref<Vuetify.VForm>();
    return {
      form
    };
  },
  name: "GeneralPrompt",
  components: { BaseModal },
  props: {
    id: {
      type: String,
      required: false,
      default: "general_prompt"
    }
  },
  data(){
    return {
      input: "",
      form_valid: false,
      resolve: function(){ return "nothing"; } as (value: string) => void,
      reject: function(){ return "nothing"; } as (value: string) => void,
      message: undefined as string | undefined,
      title: undefined as string | undefined,
      options: {
        show_cancel: true,
        header: "Input Required",
        placeholder: "Input value",
        type: "text",
        submit_text: "Submit",
        rules: [] as ((value: string) => boolean)[]
      } as GeneralPopup.PromptOptionsInternal
    };
  },
  computed: {
    action(): BaseModalN.ActionItem[]{
      return [
        {
          text: "Cancel",
          action: this.cancel,
          color: "undefined",
          enabled: this.showCancel
        } as BaseModalN.ActionItem,
        {
          text: (): string => {
            return this.options.submit_text || "Submit";
          },
          action: this.submitted,
          disabled: (): boolean => {
            return !this.form_valid;
          }
        } as BaseModalN.ActionItem
      ] as BaseModalN.ActionItem[];
    },
    inputMin(): number{
      return this.options.input_min ? this.options.input_min : 0;
    },
    inputMax(): number{
      return this.options.input_max ? this.options.input_max : 9999999;
    }
  },
  methods: {
    formInput(): void{
      // Do nothing here
    },
    showCancel(): boolean{
      return this.options.show_cancel;
    },
    open(message: string, title: string, options: GeneralPopup.PromptOptions): Promise<string>{
      this.title = title;
      this.message = message;
      this.options = Object.assign(this.options, options);
      if(!Array.isArray(this.options.rules)){
        this.options.rules = [] as (()=> boolean)[];
      }
      this.$modal.show(this.id);
      return new Promise((resolve, reject) => {
        this.resolve = resolve;
        this.reject = reject;
      });
    },
    submitted(): void{
      if(!this.form_valid){
        return;
      }
      this.resolve(this.input);
      this.$modal.hide(this.id);
    },
    cancel(): void{
      this.reject("CANCELED");
      this.$modal.hide(this.id);
    },
    beforeOpen(): void{
      // Nothing here
    },
    closed(): void{
      this.reject("CLOSED");
      this.title = undefined;
      this.message = undefined;
      this.input = "";
      this.options = {
        show_cancel: true,
        header: "Input Required",
        placeholder: "Input value",
        input_max: undefined,
        input_min: undefined,
        type: "text",
        rules: [] as (() => boolean)[],
        submit_text: "Submit"
      } as GeneralPopup.PromptOptionsInternal;
      (this.$refs.form as Vuetify.VForm).resetValidation();
    }
  }
});
</script>
<style scoped>
  .message{
    white-space: pre-wrap;
  }
  .confirm-title{
    font-size: 18px;
    font-weight: 500;
    line-height: 2rem;
    letter-spacing: 0.0125em !important;
    font-family: "Roboto", sans-serif !important;
  }
</style>