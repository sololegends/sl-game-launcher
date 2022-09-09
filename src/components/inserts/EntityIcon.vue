<template>
  <fa-icon
    style="margin-right:3px"
    :icon="icon"
    :size="icon_size"
  />
</template>

<script lang="ts">
import { defineComponent } from "@vue/composition-api";
export default defineComponent({
  name: "EntityIcon",
  components: { },
  props: {
    entity: {
      type: String,
      required: true
    },
    os: {
      type: String,
      required: false,
      default: undefined
    },
    icon_size: {
      type: String,
      required: false,
      default: "sm"
    }
  },
  computed: {
    text(): string{
      return this.entity.split(":")[1];
    },
    type(): string{
      return this.entity.split(":")[0];
    },
    icon(): string | string[]{
      if(this.os !== undefined){
        switch(this.os){
        case "ANDROID": return [ "fab", "android" ];
        case "APPLE": return [ "fab", "apple" ];
        case "CENTOS": return [ "fab", "centos" ];
        case "CHROME": return [ "fab", "chrome" ];
        case "CISCO": return "fas fa-ethernet";
        case "DOCKER": return [ "fab", "docker" ];
        case "FREEBSD": return [ "fab", "freebas" ];
        case "LINUX": return [ "fab", "linux" ];
        case "RASPBERRYPI": return [ "fab", "raspberry-pi" ];
        case "REDHAT": return [ "fab", "redhat" ];
        case "SUSE": return [ "fab", "suse" ];
        case "UBUNTU": return [ "fab", "ubuntu" ];
        case "WINDOWS": return [ "fab", "windows" ];
        default: break;
        }
      }
      switch(this.type){
      case "user": return "user";
      case "os":
        switch(this.text){
        case "ANDROID": return [ "fab", "android" ];
        case "APPLE": return [ "fab", "apple" ];
        case "CENTOS": return [ "fab", "centos" ];
        case "CHROME": return [ "fab", "chrome" ];
        case "CISCO": return "fas fa-ethernet";
        case "DOCKER": return [ "fab", "docker" ];
        case "FREEBSD": return [ "fab", "freebas" ];
        case "LINUX": return [ "fab", "linux" ];
        case "RASPBERRYPI": return [ "fab", "raspberry-pi" ];
        case "REDHAT": return [ "fab", "redhat" ];
        case "SUSE": return [ "fab", "suse" ];
        case "UBUNTU": return [ "fab", "ubuntu" ];
        case "WINDOWS": return [ "fab", "windows" ];
        default: return "question-circle";
        }
      default: return "question-circle";
      }
    }
  }
});
</script>