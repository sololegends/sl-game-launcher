<template>
  <base-modal
    :id="id" :title="options.header" persistent
    :light_header="true" :action="action" :closeable='false'
    :modal_width='450' @before-open="beforeOpen" @closed="closed"
    :show_cancel="options.show_cancel"
  >
    <div class="confirm-title">{{title}}</div>
    <br  v-if="options.header">
    <div class="message">
      <span class="text-subtitle-2">{{message}} </span>
    </div>
  </base-modal>
</template>

<script lang="ts">
import BaseModal from "@modals/BaseModal.vue";
import {BaseModalN} from "base_modal";
import { defineComponent } from "@vue/composition-api";
import filters from "@/js/filters";
import { GeneralPopup } from "confirmation_modal";

export default defineComponent({
  name: "GeneralConfirm",
  components: { BaseModal },
  props: {
    id: {
      type: String,
      required: false,
      default: "general_confirm"
    }
  },
  data(){
    return {
      resolve: function(){ return "nothing"; } as (value: string | boolean) => void,
      reject: function(){ return "nothing"; } as (value: string | boolean) => void,
      message: undefined as string | undefined,
      title: undefined as string | undefined,
      options: {
        show_cancel: true,
        header: "Confirmation Required"
      } as GeneralPopup.PromptOptionsInternal
    };
  },
  computed: {
    action(): BaseModalN.ActionItem[]{
      return [
        {
          text: "Confirm",
          name: "confirm",
          action: this.confirm
        }
      ] as BaseModalN.ActionItem[];
    }
  },
  methods: {
    showCancel(): boolean{
      return this.options.show_cancel;
    },

    open(message: string, title: string, options: GeneralPopup.ConfirmOptions): Promise<string | boolean>{
      this.title = title;
      this.message = message;
      this.options = Object.assign(this.options, options);
      this.$modal.show(this.id);
      return new Promise((resolve, reject) => {
        this.resolve = resolve;
        this.reject = reject;
      });
    },
    confirm(): void{
      this.resolve(true);
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
      this.options = {
        show_cancel: true,
        header: "Confirmation Required"
      } as GeneralPopup.PromptOptionsInternal;
    },
    capitalize: filters.capitalize
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