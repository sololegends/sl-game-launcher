
import axios from "axios";
import router from "./router/index";
import Vue from "vue";
import { Vuetify } from "vuetify/types";
import Vuex from "vuex";

declare module "*.vue" {
  export default Vue;
}

type VuetifyRules = {
  required: (value: null | number | string) => boolean
  required_simple: () => boolean
  numericMinMax: (min: number, max: number) => boolean
  domain_ip: (value: string) => boolean
  domain: (value: string) => boolean
  lengthExact: (length: number) => boolean
  lengthMax: (max: number, required?: boolean) => boolean
  lengthMinMax: (min: number, max: number, required?: boolean) => boolean
  required_select_object: (value: object) => boolean
  validUsername: (value: string) => boolean
};

declare module "vue/types/vue" {
  interface Vue {
    $api: axios
    $gog_api: axios
    $gog_com: axios
    $router: typeof router
    $store: typeof Vuex
  }
}

declare module "vue/types/options" {
  interface ComponentOptions {
    vuetify?: Vuetify;
  }
}