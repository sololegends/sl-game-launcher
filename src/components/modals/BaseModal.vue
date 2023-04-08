<template>
  <v-dialog
    ref="modal" :id="'modal_'+id" :name="id"
    transition="dialog-top-transition"
    :retain-focus="filteredActions.length!=0" :width="modal_width" :scrollable="true"
    :persistent="persistent" :value="visible"  @click:outside="closeModalOutside"
  >
    <v-card :id="'modal_card_'+id" :width="modal_width" :height="modal_height">
      <v-toolbar class="primary" :height="light_header?'55px':'175px'">
        <v-btn icon class="close-button white--text" @click="closeModal" title="Close" v-if="closeable || show_cancel">
          <fa-icon size="2x" icon="times" />
        </v-btn>
        <div :class="bgkClasses">
          <img src="../../assets/logo.png" v-if="!light_header">
          <div class="title white--text"  v-if="!light_header">{{$properties.company}} {{$properties.app}}</div>
          <div :class="titleClass" :tip-title="title">{{ title }}</div>
        </div>
      </v-toolbar>
      <div class="error-message">{{ error_message }}</div>

      <v-card-text :class="no_margin?'no-margin':(small_margin?'sm-margin':'')">
        <ScrollablePanel class="body-slot" v-if="scrollable">
          <slot />
        </ScrollablePanel>
        <div class="body-slot" v-else>
          <slot />
        </div>
      </v-card-text>

      <v-divider v-if="(action && action.length!=0)||!(closeable&&show_cancel)" />
      <v-card-actions>
        <div class="text-left">
          <slot name="actions-left" />
        </div>
        <v-spacer />
        <div class="text-right">
          <v-btn style="opacity:0;" v-if="!(filteredActions.length!=0||!(closeable&&show_cancel))"></v-btn>
          <v-spacer />
          <v-btn @click="closeModal" v-if="!closeable&&show_cancel">Cancel</v-btn>
          <v-btn
            v-for="item in filteredActions"
            :key="dynamicProp(item.text)"
            :name="dynamicProp(item.name)"
            :loading="dynamicProp(item.loading, false)"
            :id="'edit_user_' + dynamicProp(item.text)"
            :type="item.name===undefined ? 'button' : 'submit'"
            :class="'modal-btn ' + buttonTheme(item)"
            @click="actionClick(item, $event)"
            :style="'background-color:' + item.color"
            :disabled="dynamicProp(item.disabled, false)"
          >
            {{dynamicProp(item.text)}}
          </v-btn>
        </div>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<script lang="ts">
import { BaseModalN } from "base_modal";
import { defineComponent } from "@vue/composition-api";
import ScrollablePanel from "@general/ScrollablePanel.vue";

export default defineComponent({
  components: {ScrollablePanel},
  name: "BasicModal",
  props: {
    id: {
      type: String,
      required: true
    },
    title: {
      type: String,
      required: false,
      default: undefined
    },
    closeable: {
      type: Boolean,
      required: false,
      default: true
    },
    persistent: {
      type: Boolean,
      required: false,
      default: false
    },
    show_cancel: {
      type: Boolean,
      required: false,
      default: true
    },
    action: {
      type: Array as () => BaseModalN.ActionItem[],
      required: false,
      default: undefined
    },
    modal_height: {
      type: Number,
      required: false,
      default: undefined
    },
    modal_width: {
      type: [ Number, String ],
      required: false,
      default: 400
    },
    light_header: {
      type: Boolean,
      required: false,
      default: false
    },
    scrollable: {
      type: Boolean,
      required: false,
      default: true
    },
    small_margin: {
      type: Boolean,
      required: false,
      default: false
    },
    no_margin: {
      type: Boolean,
      required: false,
      default: false
    }
  },
  data(){
    return {
      error_message: null as string | null,
      visible: false
    };
  },
  computed: {
    titleClass(): string{
      return (this.light_header ? "text-h6" : "text-subtitle-2") + " modal-header-text white--text";
    },
    bgkClasses(): string{
      return "modal-header" + (this.light_header ? " light" : "");
    },
    filteredActions(): BaseModalN.ActionItem[]{
      const tmp = [];
      for(const i in this.action){
        if(this.dynamicProp(this.action[i].enabled, true)){
          tmp.push(this.action[i]);
        }
      }
      return tmp;
    }
  },
  methods: {
    actionClick(item: BaseModalN.ActionItem, e: Event){
      item.action(item, e);
    },
    closeModalOutside(): void{
      if(!this.persistent){
        this.closeModal();
      }
    },
    closeModal(): void{
      this.$modal.hide(this.id);
    },
    buttonTheme(button: BaseModalN.ActionItem): string{
      if(button.color !== undefined && button.color !== ""){
        return button.color;
      }
      if (button.text === "Delete"){
        return "red";
      } else {
        return "primary";
      }
    },
    open(params: BaseModalN.Params): void{
      // If in the pending time before close on open, finish the close first
      if(this.close_timeout !== undefined){
        this.$emit("closed", {
          name: this.id,
          ref: this.$refs.modal || null,
          state: "closed"
        });
      }
      let cancelEvent = false;
      const cancel = () => {
        cancelEvent = true;
      };
      const event = {
        name: this.id,
        ref: this.$refs.modal || null,
        cancel,
        state: "before-open",
        params
      };
      this.$emit("before-open", event);
      if (cancelEvent){ return; }
      this.visible = true;
    },
    close(params: BaseModalN.Params): void{
      let cancelEvent = false;
      const cancel = () => {
        cancelEvent = true;
      };
      const event = {
        name: this.id,
        ref: this.$refs.modal || null,
        cancel,
        state: "before-close",
        params
      };
      this.$emit("before-close", event);
      if (cancelEvent){ return; }
      this.visible = false;
      const event2 = {
        name: this.id,
        ref: this.$refs.modal || null,
        state: "closed"
      };
      // Delay closed for animation, 100ms
      const that = this;
      this.close_timeout = setTimeout(function(){
        that.close_timeout = undefined;
        that.$emit("closed", event2);
      }, 500);
    },
    toggle(name: string, open: boolean, params: BaseModalN.Params): void{
      if(this.id === name || (name === "all" && open === false)){
        if (this.visible === open){
          return;
        }
        if (open){
          this.open(params);
        } else {
          this.close(params);
        }
      }
    }
  },
  beforeMount(): void{
    this.$modal._cont.$on("toggle", this.toggle);
  },
  beforeDestroy(): void{
    this.$modal._cont.$off("toggle", this.toggle);
  }
});
</script>
<style scoped>
  .modal-btn {
    margin-left:5px;
  }

  .close-button{
    position:absolute;
    right:0px;
    top:3px;
  }

  .v-btn{
    margin-right:10px;
  }
  .v-card__actions:last-of-type .v-btn {
    margin-right: 0px;
  }

  .modal-header {
    text-align: center;
    width:100%;
  }

  .modal-header img {
    margin-bottom: 5px;
    max-width: 64px;
  }

  .modal-header.light>.text-h6{
    line-height:50px;
    vertical-align: middle;
  }

  .modal-header-text {
    white-space: nowrap;
    padding: 0px 35px;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .v-dialog>.v-card>.v-card__text {
    padding:20px;
    overflow: hidden;
    height: calc(100% - 100px);
  }
  .body-content{
    padding-top:10px;
    padding-right: 6px;
    padding-left: 6px;
    overflow-x: hidden;
  }
  .body-slot{
    height:100%;
    overflow: hidden;
  }
  .v-dialog>.v-card>.v-card__text.sm-margin{
    padding: 5px;
  }
  .v-dialog>.v-card>.v-card__text.no-margin{
    padding: 0px;
  }
</style>