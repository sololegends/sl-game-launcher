import filter from "@filters";
import Vue from "vue";

type DynamicObject = {
	[key: string]: string | number | boolean
};

export default Vue.extend({
  props: {
    data: {
      type: [ Object, Array, String, Boolean, Number ],
      required: true
    },
    small: {
      type: Boolean,
      required: false,
      default: false
    }
  },
  data(){
    return {
      root_domains: [
        "org",
        "com",
        "min",
        "net",
        "gov"
      ]
    };
  },
  computed: {
    isObject(): boolean{
      return typeof this.data === "object";
    },
    isArray(): boolean{
      return Array.isArray(this.data);
    },
    isCredential(): boolean{
      return /^{#.+}$/.test(this.data);
    },
    isNumber(): boolean{
      return !isNaN(this.data);
    },
    isNull(): boolean{
      return this.data == null || this.data === "null";
    },
    isUUID(): boolean{
      return /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[a-f0-9]{4}-[a-f0-9]{12}$/gmi.test(this.data);
    },
    isBoolean(): boolean{
      return this.data === true || this.data === false || this.data === "true" || this.data === "false";
    },
    asBool(): boolean{
      return this.data || this.data === "true";
    },
    isAPPLink(): boolean{
      return this.data.startsWith("APP_IL>>");
    }
  },
  methods: {
    convertAPPLink(link: string): string{
      return this.urlEncode(link.replace("APP_IL>>", "").replace("{#TOKEN}", this.getToken()));
    },
    getToken(): string{
      return this.$store.getters.token.replaceAll("=", "-").replaceAll("/", "_");
    },
    urlEncode(val: string): string{
      val = encodeURI(val);
      const start = val.substring(0, val.lastIndexOf("/"));
      const tail = val.substring(val.lastIndexOf("/") + 1);
      return start + "/" + encodeURIComponent(tail);
    },
    plural(num: number): string{
      return num === 0 || num > 1 ? "s" : "";
    },
    dynamicFilter(value: string | number, key: string){
      if(key === "size" && typeof value === "number" ){
        return filter.formatSize(value);
      }
      return value;
    },
    lastIndexOf(value: string, idx: string){
      return value.substring(value.lastIndexOf(idx) + 1);
    },
    buildMapTipTitle(map: DynamicObject){
      let str = "Object Data:";
      for(const key in map){
        str += "\n" + key + ": " + map[key];
      }
      return str;
    },
    shortenUUID(uuid: string): string{
      const parts = uuid.split("-");
      return parts[0] + "-" + parts[1];
    }
  }
});