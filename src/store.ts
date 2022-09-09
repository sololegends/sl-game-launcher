
import Vue from "vue";
import Vuex from "vuex";

Vue.use(Vuex);

export default new Vuex.Store({
  state: {
    minimal_ui: false,
    minimal_ui_title: "",
    dev_mode: localStorage.getItem("dev_mode") === "true"
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
    }
  },
  getters: {
    minimal_ui: (state): boolean  => state.minimal_ui,
    minimal_ui_title: (state): string  => state.minimal_ui_title,
    dev_mode: (state): boolean  => state.dev_mode
  }
});

