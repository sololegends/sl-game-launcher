import Vue, { VNode } from "vue";
import { GeneralPopup } from "confirmation_modal";
import { LaunchOptionsN } from "base_modal_ext";
import { Notify } from "./shims-app";

declare global {
  namespace JSX {
    interface Element extends VNode {}
    interface ElementClass extends Vue {}
    interface IntrinsicElements {
      [elem: string]: any;
    }
  }

  interface Window {
    APP_VERSION: string;
    BUILD_DATE: string;
    notify: (params: Notify.Alert, group?: string) => string | number;
    notify_data: Notify.Data;
    confirm_modal: {
      open: GeneralPopup.ConfirmFn
    }
		prompt_modal: {
      open: GeneralPopup.PromptFn
    }
		question_modal: {
      open: GeneralPopup.QuestionFn
    }
    launch_option_modal:{
      open: LaunchOptionsN.LaunchOptionsFn
    }
  }
}
