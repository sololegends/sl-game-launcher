/* eslint-disable no-console */

import { register } from "register-service-worker";
import Vue from "vue";

/* global process */
if (process.env.NODE_ENV === "production"){
  register(`${process.env.BASE_URL}firebase-messaging-sw.js`, {
    scope: ".",
    ready(){
      console.log(
        "App is being served from cache by a service worker.\n" +
        "For more details, visit https://goo.gl/AFskqB"
      );
    },
    registered(){
      console.log("Service worker has been registered.");
    },
    cached(){
      console.log("Content has been cached for offline use.");
    },
    fetch(){
      console.log("Content has been cached for offline use.");
    },
    updatefound(){
      console.log("New content is downloading.");
    },
    updated(){
      Vue.prototype.$notify({
        closed: function(){ Vue.prototype.$router.go(); },
        sticky: true,
        title: "New App Version!",
        text: "Please refresh to ensure best functionality.",
        type: "warning"
      });
    },
    offline(){
      console.log("No internet connection found. App is running in offline mode.");
    },
    error(error){
      console.error("Error during service worker registration:", error);
    }
  });
}
