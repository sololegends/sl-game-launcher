
import Vue from "vue";

declare module "vue/types/vue" {
  interface Vue {
		sleep: (milliseconds: number) => Promise<void>
  }
}

export default Vue.extend({
  methods: {
    async sleep(milliseconds: number): Promise<void>{
      return new Promise<void>((resolved) => {
        setTimeout(() => {
          resolved();
        }, milliseconds);
      });
    }
  }
});
