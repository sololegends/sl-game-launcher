<template>
  <base-modal
    id="change_password" :title="'Change Password'"
    :action="action" :closeable="false"
    @before-open="beforeOpen" @closed="closed"
    light_header
  >
    <div>{{message}}</div>
    <div class="error-message">{{ error_message }}</div>
    <v-form @submit.prevent="() =>{}" v-model="form_valid" ref="form" @input="formInput">
      <v-text-field
        v-model="password"
        :type="passwd_show ? 'text' : 'password'"
        @keyup="enterCheck"
        :rules="[$rules.required]"
        label="Current Password"
      >

        <template v-slot:append>
          <fa-icon
            style="cursor:pointer;" class="text--secondary"
            :icon="passwd_show ? 'eye' : 'eye-slash'" @click="passwd_show = !passwd_show"
          />
        </template>
      </v-text-field>

      <v-text-field
        v-model="new_password"
        :type="new_password_show ? 'text' : 'password'"
        @keyup="enterCheck"
        counter :rules="[does_not_match_current]"
        label="New Password"
      >

        <template v-slot:append>
          <fa-icon
            style="cursor:pointer;" class="text--secondary"
            :icon="new_password_show ? 'eye' : 'eye-slash'" @click="new_password_show = !new_password_show"
          />
        </template>
      </v-text-field>

      <v-text-field
        v-model="confirm_password"
        :type="confirm_password_show ? 'text' : 'password'"
        @keyup="enterCheck"
        counter :rules="[matches_new]"
        label="Confirm Password"
      >

        <template v-slot:append>
          <fa-icon
            style="cursor:pointer;" class="text--secondary"
            :icon="confirm_password_show ? 'eye' : 'eye-slash'" @click="confirm_password_show = !confirm_password_show"
          />
        </template>
      </v-text-field>
    </v-form>
  </base-modal>
</template>

<script lang="ts">
import { defineComponent, ref } from "@vue/composition-api";
import BaseModal from "@modals/BaseModal.vue";
import { BaseModalN } from "base_modal";
import {ipcRenderer as ipc} from "electron";
import { PasswordResetN } from "base_modal_ext";
import { Vuetify } from "@/plugins/vuetify/vuetify";

export default defineComponent({
  setup(){
    const form = ref<Vuetify.VForm>();
    return {
      form
    };
  },
  name: "ChangePassword",
  components: { BaseModal },
  props: {
    require_current: {
      type: Boolean,
      required: false,
      default: false
    }
  },
  data(){
    return {
      message: "",
      password: "",
      new_password: "",
      confirm_password: "",
      form_valid: false,
      passwd_show: false,
      new_password_show: false,
      confirm_password_show: false,
      username: "",
      error_message: "",
      successful_fn: undefined as undefined | (() => void),
      action_disabled: false,
      loading: false
    };
  },
  computed: {
    action(): BaseModalN.ActionItem[]{
      return [{
        text: "Submit",
        action: this.submitPass,
        disabled: this.action_disabled,
        loading: this.loading
      } as BaseModalN.ActionItem];
    }
  },
  methods: {
    matches_new(v: string): boolean | string{
      return v === this.new_password || "New Password don't match";
    },
    does_not_match_current(v: string): boolean | string{
      return v !== this.password || "Cannot be the same as current Password";
    },
    formInput: function(){
      this.action_disabled = !this.form_valid;
    },
    async submitPass(){
      if(!this.form_valid){ return; }
      this.error_message = "";
      this.loading = true;
      // This function will be used for the password reset from the settings
      const result = await ipc.invoke("change-password", this.username, this.password, this.new_password);
      this.loading = false;
      if(result === true){
        this.$notify({
          title: "Your password was updated!",
          type: "success"
        });
        this.$modal.hide("change_password");
        this.error_message = "";
        return;
      }
      this.error_message = result;
    },
    enterCheck: function(e: KeyboardEvent){
      if(e.key === "Enter"){
        this.submitPass();
      }
    },
    beforeOpen(e: PasswordResetN.Params){
      this.message = e.params.message;
      this.username = e.params.username;
    },
    closed(){
      this.username = "";
      this.message = "";
      this.password = "";
      this.new_password = "";
      this.confirm_password = "";
      this.error_message = "";
      (this.$refs.form as Vuetify.VForm).resetValidation();
    }
  }
});
</script>
<style scoped>
.error-message{
  white-space:pre-wrap;
}
</style>