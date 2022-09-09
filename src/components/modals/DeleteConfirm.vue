<template>
  <base-modal
    :id="id" :title="'Delete '+capitalize(type)"
    :light_header="true" :action="action" :closeable='false'
    :modal_width='450' @before-open="beforeOpen" @closed="closed"
  >
    <div class="text-h6">Are you ABSOLUTELY SURE?</div>
    <div class="error-message">
      You are about to permanently delete {{type}}
      <code-block v-if="Array.isArray(name)">
        - {{name.join("\n - ")}}
      </code-block>
      <code v-else>{{retainSpacesHtml(name)}}</code>
      <br>
      <span v-if="multiple">Once {{type}} are deleted they <b>cannot be recovered.</b></span>
      <span v-else>Once a {{type}} is deleted it <b>cannot be recovered.</b></span>
    </div>
    <div class="error-message">{{ error_message }}</div>
    <br>

    <div class="message">
      <span class="text-subtitle-2">{{message}} </span>
      <span class="text-subtitle-2">
        Please type <code>DELETE</code> in all caps to continue
      </span>
    </div>

    <v-text-field v-model="user_input" required label="Confirm"></v-text-field>

  </base-modal>
</template>

<script lang="ts">
import BaseModal from "@modals/BaseModal.vue";
import { BaseModalN } from "base_modal";
import CodeBlock from "@inserts/CodeBlock.vue";
import { defineComponent } from "@vue/composition-api";
import { DeleteConfirmN } from "base_modal_ext";
import filters from "@filters";

export type DeleteEvent = {
  item: unknown
}

export default defineComponent({
  name: "DeleteConfirm",
  components: { BaseModal, "code-block": CodeBlock},
  props: {
    id: {
      type: String,
      required: false,
      default: "delete_confirm"
    },
    type: {
      // This will be displayed in the messaging
      type: String,
      required: true
    },
    multiple: {
      type: Boolean,
      required: false,
      default: false
    },
    error_message: {
      type: String,
      required: false
    }
  },
  data(){
    return {
      user_input: "",
      item: null as unknown,
      confirm_condition: "DELETE",
      name: "",
      message: "",
      action_disabled: true
    };
  },

  updated(): void{
    this.updateDisabled();
  },
  computed: {
    action(): Array<BaseModalN.ActionItem>{
      return [
        {
          text: "Delete",
          action: this.deleteItemCheck,
          disabled: this.action_disabled
        }
      ] as Array<BaseModalN.ActionItem>;
    }
  },
  methods: {
    updateDisabled(): void{
      // To handle the delete button changing state
      if (this.user_input === this.confirm_condition){
        this.action_disabled = false;
      } else {
        this.action_disabled = true;
      }
    },

    deleteItemCheck(): void{
      if(this.user_input === this.confirm_condition){
        if(this.type === "file"){
          this.$emit("deleteConfirmed", {
            item: this.item,
            file: this.name
          });
          this.$modal.hide(this.id);
          return;
        }
        this.$emit("deleteConfirmed", {
          item: this.item
        });
        this.$modal.hide(this.id);
      }
    },

    beforeOpen(e: DeleteConfirmN.Params): void{
      this.name = e.params.name;
      this.item = e.params.item;
      this.message = e.params.message;
    },

    closed(): void{
      this.user_input = "";
      this.message = "";
    },
    retainSpacesHtml(value: string): string | null{
      return filters.retainSpacesHtml(value);
    },
    capitalize: filters.capitalize
  }
});
</script>
