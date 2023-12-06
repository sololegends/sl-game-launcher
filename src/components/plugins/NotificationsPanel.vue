<template>
  <div class="vuetify-notification-container" :group="group" :style="styles">
    <v-alert
      v-for="alert in getAlerts"
      :key="alert.id"
      :id="id_prefix+group+'_'+alert.id"
      :transition="transition"
      v-model="alert.show"
      dismissible dense
      :type="alert.type"
      :class="calcClasses"
      :prominent="prominent"
      :outlined="outlined"
      @mouseover="alert.hover = true"
      @mouseleave="alert.hover = false"
    >
      <div class="alert-body" :style="'width:' + width">
        <span class="alert-title text-subtitle-2 font-weight-bold">{{alert.title}}</span>
        <v-divider class="app-details-border" style="opacity:0.25" v-if="alert.text != undefined && alert.title !== undefined"></v-divider>
        <div :class="'text-body-2 alert-text'+(alert.timestamp || alert.action  ? ' timestamp' : '')">
          <span v-if="alert.text!==undefined && alert.text.includes('\n')">
            <div v-for="(ele, i) in alert.text.split('\n')" :key="i">
              {{ele}}
            </div>
          </span>
          <span v-else>{{alert.text}}</span>
          <div class="bottom-data">
            <v-spacer />
            <div v-if="alert.actions">
              <v-btn
                v-for="action of alert.actions" :key="action.name"
                @click="doAction(alert, action)" x-small
              >
                {{action.name}}
              </v-btn>
            </div>
            <v-btn
              @click="doAction(alert, alert.action)"
              v-if="alert.action"
              x-small
            >
              {{alert.action.name}}
            </v-btn>
            <div class="text-caption text-right alert-sub-text">{{alert.timestamp}}</div>
          </div>
        </div>
      </div>
      <div slot="close" @click="remove(alert)" class="vuetify-alert-dismiss" tip-title="Dismiss">
        <fa-icon icon="times" size="lg" v-if="alert.sticky && !alert.loading" />
        <v-progress-circular :value="alert.timer" v-else :indeterminate="alert.loading">
          <fa-icon icon="times" size="lg" />
        </v-progress-circular>
      </div>
    </v-alert>
  </div>
</template>
<script lang="ts">
import { defineComponent } from "@vue/composition-api";
import { ipcRenderer as ipc } from "electron";
import { Notify } from "@/types/notification/notify";

export default defineComponent({
  name: "NotificationsPanel",
  props: {
    group: {
      type: String,
      default: "default"
    },
    allowed_types: {
      type: Array as () => Notify.Type[],
      required: false,
      default: ()=> { return [ "error", "warning", "success", "info" ]; }
    },
    width: {
      type: [ Number, String ],
      default: 400
    },
    position: {
      type: Object as () => Notify.Position,
      default: function(){ return {left: 15, bottom: 15} as Notify.Position; }
    },
    fixed: {
      type: Boolean,
      default: true
    },
    classes: {
      type: String,
      default: ""
    },
    outlined: {
      type: Boolean,
      default: false
    },
    dense: {
      type: Boolean,
      default: false
    },
    prominent: {
      type: Boolean,
      default: true
    },
    transition: {
      type: String,
      default: "scroll-x-transition"
    },
    duration: {
      type: Number,
      default: 4000
    },
    max_alerts: {
      type: Number,
      default: 5
    },
    reverse: {
      type: Boolean,
      default: false
    }
  },
  data(){
    return {
      id_prefix: "vuetify_alert_",
      alerts: [] as Notify.AlertInternal[],
      alerts_display: [] as Notify.AlertInternal[]
    };
  },
  computed: {
    getAlerts(): Notify.AlertInternal[]{
      if(this.reverse){
        return [...this.alerts_display].reverse();
      }
      return this.alerts_display;
    },
    calcClasses(): string{
      return "vuetify-notification" + (this.dense ? " dense" : "") + this.classes;
    },
    styles(): string{
      let style = "";
      // Positional style
      if(this.position.top !== undefined){
        style += "top:" + this.position.top + "px;";
      }
      if(this.position.right !== undefined){
        style += "right:" + this.position.right + "px;";
      }
      if(this.position.bottom !== undefined){
        style += "bottom:" + this.position.bottom + "px;";
      }
      if(this.position.left !== undefined){
        style += "left:" + this.position.left + "px;";
      }
      style += "width:" + (typeof this.width === "string" ? this.width : this.width + "px;");
      style += "position:" + (this.fixed ? "fixed" : "relative") + ";";
      if(!this.outlined){
        style += "border-left-color:rgba(0,0,0,0.22)!important;";
      }
      return style;
    }
  },
  methods: {
    doAction(alert: Notify.AlertInternal, action?: Notify.Action){
      if(action){
        ipc.send(action.event, action.data);
        if(action.clear){
          this.remove(alert);
        }
      }
    },
    remove(alert: Notify.AlertInternal, do_global_alert = true): void{
      if(alert === undefined){ return; }
      this.$emit("alertClosed", alert);
      if(do_global_alert){
        this.$notifyClear(alert.id);
      }
      // Wait until after fade out
      if(alert.closed !== undefined && typeof alert.closed === "function"){
        alert.loading = true;
        const promise = alert.closed(alert);
        if(promise !== undefined && typeof promise.then === "function"){
          promise.then(()=>{
            this.dispose(alert);
          });
          return;
        }
      }else if(alert.closed !== undefined && typeof alert.closed === "string"){
        alert.loading = true;
        ipc.invoke(alert.closed).then(() => {
          this.dispose(alert);
        });
      }
      this.dispose(alert);
    },
    dispose(alert: Notify.AlertInternal): void{
      const that = this;
      alert.loading = false;
      alert.show = false;
      this.$emit("alertDisposed", alert);
      if(that.alerts.indexOf(alert) !== -1){
        that.alerts.splice(that.alerts.indexOf(alert), 1);
      }
      setTimeout(
        function(){
          if(that.alerts_display.indexOf(alert) !== -1){
            that.alerts_display.splice(that.alerts_display.indexOf(alert), 1);
          }
          that.emitUpdate();
        }, 250
      );
    },
    emitUpdate(): void{
      this.$emit("update", this.alerts);
    },
    clear(): void{
      for(const i in this.alerts){
        this.remove(this.alerts[i]);
      }
    },
    awaitClose(alert: Notify.AlertInternal): void{
      if(!alert.hover){
        // Controls the timer circle
        alert.timer += 10;
      }
      if(alert.timer > 100){
        return this.remove(alert, false);
      }
      const that = this;
      setTimeout(
        function(){
          that.awaitClose(alert);
        },
        alert.interval
      );
    },
    notifyClear(id: number): void{
      for(const i in this.alerts){
        if(this.alerts[i].id === id){
          this.dispose(this.alerts[i]);
          return;
        }
      }
    },
    hasId(id: number): boolean{
      for(const i in this.alerts){
        if(this.alerts[i].id === id){
          return true;
        }
      }
      return false;
    },
    notify(params: Notify.Alert, id: number): void{
      // Filter on type
      if(!this.allowed_types.includes(params.type)){
        return;
      }
      const params_int = params as Notify.AlertInternal;
      if(params_int.text && typeof params_int.text !== "string"){
        params_int.text = JSON.stringify(params_int.text);
      }
      // Add the notification
      params_int.show = false;
      params_int.hover = false;
      params_int.timer = 0;
      params_int.id = params.id || id;
      params_int.loading = params.loading || false;
      params_int.sticky = params.sticky || (this.duration === -1);
      params_int.interval = params.duration || this.duration / 10;
      params_int.action = params.action;

      // De-dupe
      if(this.hasId(id)){
        return;
      }

      const that = this;
      params_int.clear = function(){
        that.dispose(params_int);
      };
      // Add alert to values
      this.alerts.push(params_int);
      this.alerts_display.push(params_int);
      if(this.max_alerts !== -1 && this.alerts.length > this.max_alerts){
        this.dispose(this.alerts[0]);
      }
      this.emitUpdate();
      setTimeout(function(){ params_int.show = true; }, 100);
      // If timeout is enabled
      if(this.duration !== -1 && params_int.sticky !== true){
        this.awaitClose(params_int);
      }else if(params_int.timestamp === undefined){
        const date = new Date();
        params_int.timestamp =
          date.getFullYear()
          + "-" + (date.getMonth() + 1)
          + "-" + date.getDate()
          + " " + date.getHours()
          + ":" + date.getMinutes();
      }
    }
  },
  beforeMount(): void{
    this.$notify_data._cont.$on("notify>" + this.group, this.notify);
    this.$notify_data._cont.$on("notifyClear", this.notifyClear);
  },
  beforeDestroy(): void{
    this.$notify_data._cont.$off("notify>" + this.group, this.notify);
    this.$notify_data._cont.$off("notifyClear", this.notifyClear);
  }
});
</script>

<style scoped>
  .alert-sub-text{
    /* position:absolute; */
    right:5px;
    bottom:0px;
    padding-left:10px;
    display: inline-flex;
  }
  .bottom-data{
    display:flex;
    position:absolute;
    bottom:2px;
    right:5px;
  }
  .alert-text{
    word-break: break-word;
  }
  .alert-text.timestamp{
    padding-bottom: 12px;
  }
  .alert-body{
    overflow-x: hidden;
    text-overflow: ellipsis;
    padding-right: 10px;
  }
  .alert-title{
    word-break: break-word;
  }
  .alert-title.break-all{
    word-break: break-all;
  }
</style>
<style>
.vuetify-notification-container{
  position: relative;
  /* z-index: 9999; */
}
.v-application .vuetify-notification-container> .vuetify-notification{
  border-left: 8px solid rgba(0,0,0,0.22);
}
.v-application .vuetify-notification-container> .vuetify-notification.dense{
  margin-bottom:2px;
}
.vuetify-alert-dismiss{
  cursor:pointer;
}
.vuetify-alert-dismiss:hover{
  color:#D8D3CC;
}
</style>