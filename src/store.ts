
import { ipcRenderer } from "electron";
import Vue from "vue";
import Vuex from "vuex";

Vue.use(Vuex);

export default new Vuex.Store({
  state: {
    minimal_ui: false,
    minimal_ui_title: "",
    dev_mode: localStorage.getItem("dev_mode") === "true",
    offline: false,
    show_uninstalled: localStorage.getItem("show_uninstalled") === "true",
    show_repacked_only: localStorage.getItem("show_repacked_only") === "true"
  },
  mutations: {
    set_minimal_ui(state, minimal_ui){
      state.minimal_ui = minimal_ui;
    },
    set_minimal_ui_title(state, minimal_ui_title){
      state.minimal_ui_title = minimal_ui_title;
    },
    set_dev_mode(state, dev_mode){
      state.dev_mode = dev_mode;
      localStorage.setItem("dev_mode", dev_mode);
    },
    set_offline(state, offline){
      state.offline = offline;
      ipcRenderer.send("cfg-set", "offline", offline);
    },
    set_show_uninstalled(state, show_uninstalled){
      state.show_uninstalled = show_uninstalled;
      localStorage.setItem("show_uninstalled", show_uninstalled);
    },
    set_show_repacked_only(state, show_repacked_only){
      state.show_repacked_only = show_repacked_only;
      localStorage.setItem("show_repacked_only", show_repacked_only);
    }
  },
  actions: {
    set_minimal_ui({ commit }, minimal_ui: boolean){
      commit("set_minimal_ui", minimal_ui);
    },
    set_minimal_ui_title({ commit }, minimal_ui_title: string){
      commit("set_minimal_ui_title", minimal_ui_title);
    },
    set_dev_mode({ commit }, dev_mode: string){
      commit("set_dev_mode", dev_mode);
    },
    set_offline({ commit }, offline: string){
      commit("set_offline", offline);
    },
    set_show_uninstalled({ commit }, show_uninstalled: string){
      commit("set_show_uninstalled", show_uninstalled);
    },
    set_show_repacked_only({ commit }, show_repacked_only: string){
      commit("set_show_repacked_only", show_repacked_only);
    }
  },
  getters: {
    minimal_ui: (state): boolean  => state.minimal_ui,
    minimal_ui_title: (state): string  => state.minimal_ui_title,
    dev_mode: (state): boolean  => state.dev_mode,
    offline: (state): boolean  => state.offline,
    showUninstalled: (state): boolean => state.show_uninstalled,
    showRepackedOnly: (state): boolean => state.show_repacked_only
  }
});

