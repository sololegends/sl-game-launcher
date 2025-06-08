<template>
  <v-card class="login-form no-sel">
    <v-card-title>
      <h2>Login</h2>
    </v-card-title>
    <v-card-text>
      <span :class="'error-text' + (error ? '' : ' hide')">{{error ? error : "&nbsp;"}}</span>
      <v-text-field
        v-model="username"
        type="text" filled :error="field_error"
        @keyup="enterCheck" label="Username"
      >
      </v-text-field>

      <v-text-field
        v-model="password"
        :type="passwd_show ? 'text' : 'password'" filled :error="field_error"
        @keyup="enterCheck" label="Password"
      >
        <fa-icon
          slot="append"
          style="cursor:pointer;" class="text--secondary"
          :icon="passwd_show?'eye':'eye-slash'" @click="passwd_show = !passwd_show"
        />
      </v-text-field>
    </v-card-text>
    <v-card-actions class="text-right">
      <v-spacer />
      <v-btn color="warning" @click="goOffline">Go Offline</v-btn>
      <v-btn color="error" @click="quit">Quit</v-btn>
      <v-btn color="primary" @click="login" :loading="loading">
        <fa-icon v-if="error" icon="exclamation-triangle" size="2x" class="error-icon" :tip-title="error" />
        <span v-else>Login</span>
      </v-btn>
    </v-card-actions>
  </v-card>
</template>

<script lang="ts">
import { defineComponent } from "@vue/composition-api";
import {ipcRenderer as ipc} from "electron";

export default defineComponent({
  name: "LoginView",
  components: {
  },
  props: {

  },
  data(){
    return {
      message: "Loading...",
      indeterminate: false,
      start_time: 0,
      username: "",
      password: "",
      passwd_show: false,
      loading: false,
      error: undefined as undefined | string,
      field_error: false
    };
  },
  computed: {
  },
  mounted(){
    this.$store.dispatch("set_minimal_ui", false);
    this.$store.dispatch("set_light_ui", true);
  },
  beforeDestroy(){
    // Nothing
  },
  methods: {
    enterCheck(e: KeyboardEvent){
      this.error = undefined;
      this.field_error = false;
      // If enter pressed
      if(e?.key === "Enter"){
        // Attempt login
        this.login();
      }
    },
    quit(){
      ipc.send("quit");
    },
    goOffline(){
      this.$store.dispatch("set_offline", true);
      console.log("Go to main window");
      ipc.send("goto-main-window");
    },
    async login(): Promise<boolean>{
      if(this.username.length === 0 || this.password.length === 0){
        this.loading = false;
        this.field_error = true;
        this.error = "Username and Password required";
        return false;
      }
      this.loading = true;
      this.error = undefined;
      ipc.send("cfg-set", "api", {
        user: this.username,
        pass: this.password
      }, true);
      const login_result = await ipc.invoke("login", {
        user: this.username,
        pass: this.password
      });
      if(login_result === true){
        this.loading = false;
        this.loggedIn();
        return true;
      } else {
        this.loading = false;
        this.error = login_result;
        return false;
      }
    },
    async loggedIn(){
      // Attempt login through backplane
      this.$store.dispatch("set_offline", false);
      console.log("Go to main window");
      ipc.send("goto-main-window");
    }
  }
});
</script>

<style scoped>
.error-text{
  color: var(--v-error-base);
  font-size: 16px;
  font-weight: bold;
}
.error-text.hide{
  opacity: 0;
}
.error-icon{
  color: var(--v-warning-base)
}
.login-form{
  padding: 20px;
  padding-top: 5px;
  height: 100%;
  width: 100%;
}
.login-form .text{
  padding-left: 10px;
  padding-top: 5px;
}

</style>