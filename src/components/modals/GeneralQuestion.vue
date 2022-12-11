<template>
  <base-modal
    :id="id" :title="options.header" persistent
    :light_header="true" :action="action" :closeable='false'
    :modal_width='450' @before-open="beforeOpen" @closed="closed"
    :show_cancel="false"
  >
    <div class="question-title">{{title}}</div>
    <br v-if="title">
    <div class="message">
      <span class="text-subtitle-2 text-pre-wrap">{{message}} </span>
    </div>
  </base-modal>
</template>

<script lang="ts">
import BaseModal from "@modals/BaseModal.vue";
import {BaseModalN} from "base_modal";
import { defineComponent } from "@vue/composition-api";
import { GeneralPopup } from "confirmation_modal";

export default defineComponent({
  name: "GeneralQuestion",
  components: { BaseModal },
  props: {
    id: {
      type: String,
      required: false,
      default: "general_question"
    }
  },
  data(){
    return {
      resolve: function(){ return "nothing"; } as (value: string) => void,
      reject: function(){ return "nothing"; } as (value: string) => void,
      message: undefined as string | undefined,
      title: undefined as string | undefined,
      options: {
        buttons: [],
        header: "Attention!"
      } as GeneralPopup.QuestionOptionsInternal
    };
  },
  computed: {
    action(): BaseModalN.ActionItem[]{
      const actions = [] as BaseModalN.ActionItem[];
      for(const i in this.options.buttons){
        let id = this.options.buttons[i].id;
        if(id === undefined){
          id = this.options.buttons[i].text;
        }
        actions.push({
          text: this.options.buttons[i].text,
          name: id,
          action: this.question
        });
      }
      return actions;
    }
  },
  methods: {
    open(message: string, title: string, options: GeneralPopup.QuestionOptions): Promise<string>{
      this.title = title;
      this.message = message;
      this.options = Object.assign(this.options, options);
      this.$modal.show(this.id);
      return new Promise((resolve, reject) => {
        this.resolve = resolve;
        this.reject = reject;
      });
    },
    question(item: BaseModalN.ActionItem): void{
      this.resolve(this.dynamicString(item.name ? item.name : "ERROR"));
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
        header: "Attention!",
        buttons: []
      } as GeneralPopup.QuestionOptionsInternal;
    }
  }
});
</script>
<style scoped>
  .message{
    white-space: pre-wrap;
  }
  .text-pre-wrap{
    white-space:pre-wrap;
  }
  .question-title{
    font-size: 18px;
    font-weight: 500;
    line-height: 2rem;
    letter-spacing: 0.0125em !important;
    font-family: "Roboto", sans-serif !important;
  }
</style>