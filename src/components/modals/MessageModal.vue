<template>
  <base-modal
    id='message' :action="action" :title="title"
    :light_header="true"
    :closeable='true' modal_width="unset" @before-open="beforeOpen"
    @closed="closed"
  >
    <div class="text-subtitle-1">{{message}}.</div>
    <v-divider />
    <code class="output" id="output">{{api_output}}</code>
  </base-modal>
</template>

<script lang="ts">
import BaseModal from "@modals/BaseModal.vue";
import { BaseModalN } from "base_modal";
import { defineComponent } from "@vue/composition-api";
import { MessageModalN } from "base_modal_ext";
export default defineComponent({
  components: {
    BaseModal
  },
  props: {
    title: {
      type: String,
      required: false,
      default: "System Message"
    }
  },
  data(){
    return {
      item: "",
      api_output: "",
      message: "",
      action_text: "Copy to Clipboard",
      action_color: ""
    };
  },
  computed: {
    action(): BaseModalN.ActionItem[]{
      return [
        {
          text: this.action_text,
          action: this.copy,
          color: this.action_color
        } as BaseModalN.ActionItem
      ];
    }
  },
  methods: {
    beforeOpen(e: MessageModalN.Params){
      // Sets all modal vars
      this.item = e.params.item;
      this.message = e.params.message;
      this.api_output = e.params.api_output;
    },
    closed(){
      // Sets all modal vars back to null
      this.item = "";
      this.api_output = "";
      this.message = "";
      this.resetBtn();
    },
    copy: function(){
      // On button click this will copy the value of api_output to the clipboard
      if(this.$fn.copyText(this.api_output, "modal_card_message")){
        this.action_text = "Copied!";
        this.action_color = "green";
        setTimeout(this.resetBtn, 3000);
      }else{
        this.system_message = "Oops, unable to copy";
        this.action_text = "Copy Failed";
        this.action_color = "red";
        setTimeout(this.resetBtn, 5000);
      }
    },
    resetBtn(){
      this.action_text = "Copy to Clipboard";
      this.action_color = "";
    },
    close(){
      this.$modal.hide("message");
    }
  }
});
</script>

<style scoped>

  .output{
    font-size: 15px;
    margin-top: 10px;
    display: inline-block;
    white-space: pre;
  }

</style>