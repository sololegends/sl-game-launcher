<template>
  <div :class="'scrollable-wrap' + shadow_class" :style="'max-height:'+maxHeight">
    <div ref="scrollable" :class="'scrollable' + (allow_x ? '' : ' no-x')" :style="'max-height:'+maxHeight">
      <div class="scrollable-content">
        <slot />
      </div>
    </div>
  </div>
</template>

<script lang="ts">
import { defineComponent } from "@vue/composition-api";

interface ElementC extends Element {
  scrollTopMax: number
}

export default defineComponent({
  props: {
    allow_x: {
      type: Boolean,
      required: false,
      default: false
    },
    max_height: {
      type: [ Number, String ],
      required: false,
      default: "100%"
    }
  },
  data(){
    return {
      shadow_class: " " as string,
      scroll_ele: null as ElementC | null,
      interval: -1 as number
    };
  },
  mounted(): void{
    const that = this;
    this.interval = setInterval(() => {
      if(that.$refs.scrollable){
        that.scroll_ele = that.$refs.scrollable as ElementC;
        that.scroll_ele.addEventListener("scroll", that.shadowCalc);
        that.shadowCalc();
        clearInterval(that.interval);
      }
    }, 100) as unknown as number;
  },
  beforeDestroy(): void{
    clearInterval(this.interval);
  },
  computed: {
    maxHeight(): string{
      if(typeof this.max_height === "string"){ return this.max_height + ""; }
      return this.max_height + "px";
    }
  },
  methods: {
    shadowCalc(): void{
      this.$emit("scroll", {
        scrollHeight: this.scroll_ele?.scrollHeight,
        clientHeight: this.scroll_ele?.clientHeight,
        scrollTopMax: this.scroll_ele?.scrollTopMax
      });
      if(this.scroll_ele && this.scroll_ele.scrollHeight > this.scroll_ele.clientHeight){
        if(this.scroll_ele.scrollTop === 0){
          if(this.scroll_ele.scrollHeight === this.scroll_ele.clientHeight){
            this.shadow_class = " ";
            return;
          }
          this.shadow_class = " shadow-bottom";
          return;
        }
        if(this.scroll_ele.scrollTop === this.scroll_ele.scrollTopMax){
          this.shadow_class = " shadow-top";
          return;
        }
        this.shadow_class = " shadow-top shadow-bottom";
        return;
      }
      this.shadow_class = " ";
      return;
    }
  }
});
</script>
<style scoped>
  .scrollable-wrap{
    height:100%;
    width:100%;
    position:relative;
    overflow:hidden
  }
	.scrollable{
    position:relative;
		height:auto;
		width:100%;
    overflow-y: auto;
    overflow-x: auto;
	}
	.no-x{
    overflow-x: hidden;
	}
	.scrollable-content{
		padding-right:5px;
	}
  .scrollable-wrap::before, .scrollable-wrap::after{
    content:'';
    position:absolute;
    width: 150%;
    left: -25%;
    height:25px;
    z-index: 1;
    opacity:0;
    transition: 0.25s;
    pointer-events: none;
  }
  .scrollable-wrap.shadow-top::before, .scrollable-wrap.shadow-bottom::after{
    opacity:1;
  }
  .scrollable-wrap::before{
    background: radial-gradient(farthest-side at 50% -20px, rgba(0,0,0,0.2) 0%, rgba(0,0,0,0) 100%);
  }
  .scrollable-wrap::after{
    bottom:0px;
    background: radial-gradient(farthest-side at 50% 40px, rgba(0,0,0,0.2) 0%, rgba(0,0,0,0) 100%);
  }
</style>
