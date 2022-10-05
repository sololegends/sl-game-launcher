
import _Vue from "vue";
import { ipcRenderer } from "electron";
import { Notify } from "@/types/notification/notify";

export default function(Vue: typeof _Vue, options?: Notify.PluginOptions): void{

  // Vuetify Notifications plugin
  Vue.prototype.$notify_data = {
    _cont: new _Vue(),
    _id: 0,
    getId: function(): string{
      return "i" + this._id++;
    }
  };

  /**
   * Generate a new notification in the given container
   * @param params {{Notification}} - The parameters to use for creating the notification
   * @param group {{string}} - The grouping for the notification container
   */
  const notify = function(params: Notify.Alert, group = "default", icon?: string): string{
    const id = params.id || Vue.prototype.$notify_data.getId();
    Vue.prototype.$notify_data._cont.$emit("notify>" + group, params, id);
    // Send the system alert
    const obj = {
      title: params.title,
      text: params.text,
      type: params.type
    };
    ipcRenderer.send("sys-notify", obj, icon, params.action?.event, params.action?.data);
    return id;
  };

  /**
   * Sends a clear signal to the notification group
   * @param id Number - ID of the alert to be cleared
   */
  const notifyClear = function(id: number): void{
    Vue.prototype.$notify_data._cont.$emit("notifyClear", id);
  };

  Vue.prototype.$notify = notify;
  Vue.prototype.$notifyClear = notifyClear;

  if(options?.window_bind){
    window.notify = Vue.prototype.$notify;
    window.notify_data = Vue.prototype.$notify_data;
  }
}
