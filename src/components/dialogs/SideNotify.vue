<template>
  <div id="side-notify">
    <SideDrawer name="Alerts" :show="show" @click:outside="$emit('click:outside')">
      <v-card-text style="padding:15px;" slot="body">
        <div v-if="alert_count==0" class="text-h6" style="width:100%;text-align:center;">
          No Alerts!
        </div>
        <NotificationsPanel
          group="bell_alerts"
          :outlined="true" :fixed="false" :reverse="true"
          :dense="true" :position="{}" width="100%"
          :duration="-1" :max_alerts="-1"
          @update="updateCount"
        />
      </v-card-text>
      <v-btn
        slot="footer"
        style="width:100%;text-decoration:underline;"
        :loading="loading"
        bottom @click="dismissAlerts()"
      >
        Dismiss All
      </v-btn>
    </SideDrawer>
  </div>
</template>

<script lang="ts">
import { defineComponent } from "@vue/composition-api";
import NotificationsPanel from "@plugins/NotificationsPanel.vue";
import { Notify } from "@/types/notification/notify";
import SideDrawer from "@modals/SideDrawer.vue";

export default defineComponent({
  components: { NotificationsPanel, SideDrawer },
  props: {
    show: {
      type: Boolean,
      required: true
    }
  },
  data(){
    return{
      timer: -1,
      alert_stack: {},
      alert_count: 0,
      max_id: 0,
      loading: false,
      alerts: [] as  Notify.AlertInternal[]
    };
  },
  mounted(){
    this.$emit("count", this.alert_count);
  },
  beforeDestroy(){
    clearTimeout(this.timer);
    this.timer = -1;
  },
  methods: {
    updateCount(alerts: Notify.AlertInternal[]): void{
      this.alerts = alerts;
      this.alert_count = alerts.length;
      this.$emit("count", this.alert_count);
    },
    dismissAlerts(alert?: Notify.Alert): void{
      if(alert === undefined){ this.loading = true; }
      if(alert === undefined){
        const copy_alerts = [...this.alerts];
        for(const i in copy_alerts){
          copy_alerts[i].clear();
        }
      }
      this.loading = false;
    }
  }
});
</script>

<style scoped>
  .v-sheet.v-card{
    height: 100%;
  }
  .v-dialog > * {
    width: 100%;
    min-height: 98.4vh;
  }
  .header{
    box-shadow: 0px 2px 4px -1px rgb(0 0 0 / 20%), 0px 4px 5px 0px rgb(0 0 0 / 14%), 0px 1px 10px 0px rgb(0 0 0 / 12%);
  }
</style>