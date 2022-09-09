
import _Vue from "vue";
import { ContextMenu } from "./context-menu";

export default function(Vue: typeof _Vue, options?: ContextMenu.options): void{

  // Vuetify Notifications plugin
  Vue.prototype.$context_int = {
    _cont: new _Vue(),
    closeAll: function(){
      this._cont.$emit("close");
    }
  };

  if(options?.window_bind){
    window.context = Vue.prototype.$context_int;
  }
}
