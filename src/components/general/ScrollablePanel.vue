<template>
  <div :class="'scrollable-wrap' + shadow_class" :style="'max-height:'+maxHeight">
    <div ref="scrollable" :class="'scrollable' + (allow_x ? '' : ' no-x')" :style="'max-height:'+maxHeight">
      <div class="scrollable-content"  ref="content">
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

export type ScrollData = {
  scrollHeight: number
  clientHeight: number
  scrollTop: number
  scrollTopMax: number
  scrollLeft: number
  atBottom: boolean
  atTop: boolean,
  isScrollable: boolean
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
    },
    value: {
      type: Object as () => ScrollData,
      required: false
    }
  },
  data(){
    return {
      shadow_class: " " as string,
      scroll_ele: null as ElementC | null,
      scroll_cont: null as ElementC | null,
      interval: -1 as number,
      interval2: -1 as number,
      observer: undefined as undefined | ResizeObserver
    };
  },
  watch: {
    "value": {
      handler(new_val: ScrollData){
        if(this.scroll_ele && (new_val.scrollTop !== this.scroll_ele.scrollTop || new_val.scrollLeft !== this.scroll_ele.scrollLeft)){
          this.scroll_ele.scrollTo({
            behavior: "smooth",
            left: new_val.scrollLeft,
            top: new_val.scrollTop
          });
        }
      },
      deep: true
    }
  },
  mounted(): void{
    this.observer = new ResizeObserver(this.shadowCalc);
    this.interval = setInterval(() => {
      if(this.$refs.scrollable){
        clearInterval(this.interval);
        this.scroll_ele = this.$refs.scrollable as ElementC;
        this.scroll_ele.addEventListener("scroll", this.shadowCalc);
        this.shadowCalc();
      }
    }, 100) as unknown as number;
    this.interval2 = setInterval(() => {
      if(this.$refs.content && this.observer){
        clearInterval(this.interval2);
        this.scroll_cont = this.$refs.content as ElementC;
        this.observer.observe(this.scroll_cont);
        this.shadowCalc();
      }
    }, 100) as unknown as number;
  },
  beforeDestroy(): void{
    clearInterval(this.interval);
    clearInterval(this.interval2);
    if(this.scroll_ele){
      this.scroll_ele.removeEventListener("scroll", this.shadowCalc);
    }
    if(this.observer){
      this.observer.disconnect();
      this.observer = undefined;
    }
  },
  computed: {
    maxHeight(): string{
      if(typeof this.max_height === "string"){ return this.max_height + ""; }
      return this.max_height + "px";
    }
  },
  methods: {
    shadowCalc(): void{
      if(this.scroll_ele){
        const scrollTopMax = this.scroll_ele.scrollTopMax || (this.scroll_ele.scrollHeight - this.scroll_ele.clientHeight);
        this.$emit("input", {
          scrollHeight: this.scroll_ele.scrollHeight,
          clientHeight: this.scroll_ele.clientHeight,
          scrollTop: this.scroll_ele.scrollTop,
          scrollTopMax: scrollTopMax,
          scrollLeft: this.scroll_ele.scrollLeft,
          atBottom: this.scroll_ele.scrollTop === scrollTopMax,
          atTop: this.scroll_ele.scrollTop === 0,
          isScrollable: this.scroll_ele.scrollHeight < this.scroll_ele.clientHeight
        });
        // If not even scrollable
        if(this.scroll_ele.scrollHeight < this.scroll_ele.clientHeight){
          this.shadow_class = " ";
          return;
        }
        if(this.scroll_ele.scrollTop === 0){
          if(this.scroll_ele.scrollHeight === this.scroll_ele.clientHeight){
            this.shadow_class = " ";
            return;
          }
          this.shadow_class = " shadow-bottom";
          return;
        }
        if(this.scroll_ele.scrollTop === scrollTopMax){
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
