
import "roboto-fontface/css/roboto/roboto-fontface.css";
// Dead import "./registerServiceWorker";
import Vue, { VueConstructor } from "vue";
import vueCompositionApi, { createApp } from "@vue/composition-api";
import App from "@/App.vue";
import arrays from "@/plugins/arrays";
import axios from "axios";
import confirmation_modal from "@/mixins/confirmation_modal";
import context_menu from "./components/plugins/context-menu";
import ContextMenuVue from "./components/plugins/ContextMenu.vue";
import dynamic_property from "@/plugins/dynamic_property";
// Dead import firebaseMessaging from "@js/firebase";
import FontAwesome from "@/plugins/fontawesome";
import Large from "@cards/Large.vue";
import notifications from "@/plugins/notifications";
import router from "./router/index";
import sleep from "@/mixins/sleep";
import store from "./store";
import VueObserveVisibility from "vue-observe-visibility";
import vuetify from "./plugins/vuetify";
import Vuex from "vuex";



Vue.mixin(confirmation_modal);
Vue.mixin(sleep);
Vue.component("large-card", Large);

Vue.component("v-contextmenu", ContextMenuVue);
Vue.use(context_menu, { window_bind: true });

Vue.use(VueObserveVisibility);
Vue.use(vueCompositionApi);
Vue.use(Vuex);
Vue.use(FontAwesome);
Vue.use(notifications, { window_bind: true });
Vue.use(arrays);
Vue.use(dynamic_property);

Vue.prototype.$api_root = "/api";
Vue.config.productionTip = false;
Vue.prototype.$properties = {
  company: "Sololegends",
  app: "SL Launcher"
};
Vue.prototype.axios = axios;

Vue.prototype.$fn = {
  copyText: function(text: string, element: HTMLElement | string){
    if(navigator !== undefined && navigator.clipboard !== undefined){
      navigator.clipboard.writeText(text);
      return true;
    }
    let html_element = undefined;
    if(element === undefined){
      html_element = document.body;
    }else if(typeof element === "string"){
      const ele = document.getElementById(element);
      if(ele !== null){
        html_element = ele;
      }
    }
    if(html_element === undefined){
      return false;
    }
    let result = false;
    // Copy the text
    const textArea = document.createElement("textarea");
    textArea.style.position = "fixed";
    textArea.style.bottom = "0px";
    textArea.style.left = "0px";
    textArea.style.width = "2em";
    textArea.style.height = "2em";
    textArea.style.opacity = "0";
    textArea.style.zIndex = "9999999999";
    textArea.value = text;
    html_element.appendChild(textArea);
    textArea.select();
    try {
      const successful = document.execCommand("copy");
      if(successful){
        result = true;
      }
    } catch (err){
      result = false;
    }
    html_element.removeChild(textArea);
    return result;
  },
  save: function(filename: string, data: string, data_type = "text/plain"){
    const c = document.createElement("a");
    c.download = filename;

    const t = new Blob([data], {
      type: data_type
    });
    c.href = window.URL.createObjectURL(t);
    c.click();
  }
};

// App plugin
Vue.prototype.$app = {
  _cont: new Vue(),
  toggleSettings: function(){
    this._cont.$emit("toggle_settings");
  },
  toggleNotify: function(){
    this._cont.$emit("toggle_notify");
  }
};

window.APP_VERSION = "v0.10.6";
window.BUILD_DATE = "2022-12-25 10:40:33";
export default createApp({
  router,
  render: (h: ((app: VueConstructor) => void)) => h(App),
  store,
  vuetify
}).mount("#app");
