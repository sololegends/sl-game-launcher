
import GeneralConfirm from "@modals/GeneralConfirm.vue";
import { GeneralPopup } from "confirmation_modal";
import GeneralPrompt from "@modals/GeneralPrompt.vue";
import GeneralQuestion from "@modals/GeneralQuestion.vue";
import Vue from "vue";

declare module "vue/types/vue" {
  interface Vue {
		confirm: GeneralPopup.ConfirmFn
		prompt: GeneralPopup.PromptFn
		question: GeneralPopup.QuestionFn
  }
}

export default Vue.extend({
  components: {
    GeneralConfirm,
    GeneralPrompt,
    GeneralQuestion
  },
  methods: {
    async confirm(message: string, title: string, options: GeneralPopup.ConfirmOptions){
      let result = "CLOSED" as boolean | string;
      await this.$doConfirm(message, title, options).then((e: boolean | string) => {
        result = e;
      }).catch((e: boolean | string) => {
        result = e;
      });
      return result;
    },
    $doConfirm(message: string, title: string, options: GeneralPopup.ConfirmOptions): Promise<boolean | string>{
      if(window.confirm_modal){
        return window.confirm_modal.open(message, title, options);
      }
      return new Promise((resolve, reject) => {
        reject("Failed to open confirm");
      });
    },
    async prompt(message: string, title: string, options: GeneralPopup.PromptOptions){
      let result = "CLOSED";
      await this.$doPrompt(message, title, options).then((e: string) => {
        result = e;
      }).catch((e: string) => {
        result = e;
      });
      return result;
    },
    $doPrompt(message: string, title: string, options: GeneralPopup.PromptOptions): Promise<string>{
      if(window.prompt_modal){
        return window.prompt_modal.open(message, title, options);
      }
      return new Promise((resolve, reject) => {
        reject("Failed to open prompt");
      });
    },
    async question(message: string, title: string, options: GeneralPopup.QuestionOptions){
      let result = "CLOSED";
      await this.$doQuestion(message, title, options).then((e: string) => {
        result = e;
      }).catch((e: string) => {
        result = e;
      });
      return result;
    },
    $doQuestion(message: string, title: string, options: GeneralPopup.QuestionOptions): Promise<string>{
      if(window.question_modal){
        return window.question_modal.open(message, title, options);
      }
      return new Promise((resolve, reject) => {
        reject("Failed to open question");
      });
    }
  }
});
