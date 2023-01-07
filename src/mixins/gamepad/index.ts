
import gamepad_profiles from "@/json/gamepad_profiles.json";
import Vue from "vue";

export type AxisPosition = {
  x: number
  y: number
}


export default Vue.extend({
  data(){
    return {
      controllers: [] as Gamepad[],
      button_state: [] as Record<string, number>[],
      check_gp: -1,
      input_interval: -1,
      gp_listeners: {} as Record<string, (data: unknown) => void>,
      dead_zone: 0.2,
      gp_combo_listeners: {} as Record<string, (data: unknown) => void>
    };
  },
  mounted(){
    if(!this.$gamepadSupported()){
      console.error("Gamepad support not found for this browser");
      this.$emit("gamepad_error", "Gamepad support not available");
      return;
    }
    // Register handler for gamepad connect
    window.addEventListener("gamepadconnected", this.$gamepadConnected);

    // Register handler for gamepad disconnect
    window.addEventListener("gamepaddisconnected", this.$gamepadDisconnected);

    // Setup an interval gamepad connection
    // This.check_gp = setInterval(this.scanGamepads, 500) as unknown as number;

    // Register handler for gamepad input
    this.check_gp = setInterval(this.gamepadInputHandler, 50) as unknown as number;

  },
  beforeDestroy(){
    clearInterval(this.check_gp);
    clearInterval(this.input_interval);
  },
  methods: {
    $g_on(event: string | string[], handler: (data: unknown) => void): void{
      if(Array.isArray(event)){
        for(const ele of event){
          this.gp_listeners[ele] = handler;
        }
        return;
      }
      this.gp_listeners[event] = handler;
    },
    $g_onCombo(buttons: string[], handler: (data: unknown) => void){
      this.gp_combo_listeners[buttons.join("+")] = handler;
    },
    $g_emit(event: string, data: unknown): void{
      this.$emit(event, data);
      if(this.gp_listeners[event]){
        this.gp_listeners[event](data);
      }
    },
    getProfileFromId(id: string): Record<string, number>{
      if(id.toLocaleLowerCase().includes("xbox")){
        return gamepad_profiles.xbox;
      }
      return gamepad_profiles.undefined;
    },
    gamepadInputHandler(){
      this.scanGamepads();
      // Loop through controllers
      for(const i in this.controllers){
        const gamepad = this.controllers[i];
        const profile = this.getProfileFromId(gamepad.id);
        const button_combo = [];
        for(const [ key, val ] of Object.entries(profile)){
          if(gamepad.buttons[val].pressed || gamepad.buttons[val].touched){
            button_combo.push(key);
            if(this.button_state[i][val]-- < 0){
              this.button_state[i][val] = 10;
              this.$g_emit(key, gamepad.buttons[val]);
              this.$g_emit("btn" + val, gamepad.buttons[val]);
            }
          }else if(gamepad.buttons[val] === undefined){
            console.log("Non-Tracked button!", val, i, gamepad.buttons[val]);
          }else{
            this.button_state[i][val] = 0;
          }
        }
        if(button_combo.length > 0){
          if(this.gp_combo_listeners[button_combo.join("+")]){
            this.gp_combo_listeners[button_combo.join("+")](gamepad.buttons);
          }
        }
        const index = parseInt(i);
        this.assessAxisCheck("left", index, gamepad.axes[0], gamepad.axes[1]);

        if(gamepad.axes.length >= 4){
          this.assessAxisCheck("right", index, gamepad.axes[2], gamepad.axes[3]);
        }
      }
    },
    assessAxisCheck(name: "right" | "left", gpid: number, x: number, y: number){
      if(this.assessDeadZones({x: x, y: y})){
        const short = name.charAt(0);

        // Overall Stick position event
        this.$g_emit(name + "_stick", {x: x, y: y});
        if(this.button_state[gpid][name + "_stick"]-- < 0){
          this.button_state[gpid][name + "_stick"] = 10;
          this.$g_emit(name + "_stick", {x: x, y: y});
        }
        // X Axis
        if(x < 0 - this.dead_zone){
          // LEFT
          this.button_state[gpid][name + "_stick_right"] = 0;
          if(this.button_state[gpid][name + "_stick_left"]-- < 0){
            this.button_state[gpid][name + "_stick_left"] = 10;
            this.$g_emit(short + "s_left", {x: x, y: y});
          }
        }else if(x > this.dead_zone){
          // RIGHT
          this.button_state[gpid][name + "_stick_left"] = 0;
          if(this.button_state[gpid][name + "_stick_right"]-- < 0){
            this.button_state[gpid][name + "_stick_right"] = 10;
            this.$g_emit(short + "s_right", {x: x, y: y});
          }
        }else if(!this.assessDeadZones({y: 0, x})){
          this.button_state[gpid][name + "_stick_right"] = 0;
          this.button_state[gpid][name + "_stick_left"] = 0;
        }
        // Y Axis
        if(y < 0 - this.dead_zone){
          // UP
          this.button_state[gpid][name + "_stick_down"] = 0;
          if(this.button_state[gpid][name + "_stick_up"]-- < 0){
            this.button_state[gpid][name + "_stick_up"] = 10;
            this.$g_emit(short + "s_up", {x: x, y: y});
          }
        }else if(y > this.dead_zone){
          // DOWN
          this.button_state[gpid][name + "_stick_up"] = 0;
          if(this.button_state[gpid][name + "_stick_down"]-- < 0){
            this.button_state[gpid][name + "_stick_down"] = 10;
            this.$g_emit(short + "s_down", {x: x, y: y});
          }
        }else if(!this.assessDeadZones({y, x: 0})){
          this.button_state[gpid][name + "_stick_up"] = 0;
          this.button_state[gpid][name + "_stick_down"] = 0;
        }
      }else{
        this.button_state[gpid][name + "_stick_up"] = 0;
        this.button_state[gpid][name + "_stick_down"] = 0;
        this.button_state[gpid][name + "_stick_left"] = 0;
        this.button_state[gpid][name + "_stick_right"] = 0;
      }
    },
    assessDeadZones({x, y}: AxisPosition){
      return (x >= this.dead_zone || x <= 0 - this.dead_zone) || (y >= this.dead_zone || y <= 0 - this.dead_zone);
    },
    scanGamepads(): void{
      const gamepads = navigator.getGamepads();
      for (const gamepad of gamepads){
        if (gamepad){
          // Can be null if disconnected during the session
          if (this.controllers !== null && gamepad.index in this.controllers){
            this.controllers[gamepad.index] = gamepad;
          } else {
            this.addGamePad(gamepad);
          }
        }
      }
    },
    addGamePad(gamepad: Gamepad): void{
      this.$g_emit("gamepadconnected", gamepad);
      this.button_state[gamepad.index] = {};
      this.controllers[gamepad.index] = gamepad;
      this.$notify({
        type: "info",
        title: "Gamepad " + gamepad.id + " Connected"
      });
    },
    removeGamePad(gamepad: Gamepad): void{
      this.$g_emit("gamepaddisconnected", gamepad);
      delete this.controllers[gamepad.index];
      this.$notify({
        type: "warning",
        title: "Gamepad " + gamepad.id + " Disconnected"
      });
    },
    $gamepadSupported(): boolean{
      return "getGamepads" in navigator;
    },
    $gamepadConnected(e: GamepadEvent): void{
      console.log("GAMEPAD CONNECTED: ", e);
      this.addGamePad(e.gamepad);
    },
    $gamepadDisconnected(e: GamepadEvent): void{
      console.log("GAMEPAD DISCONNECTED: ", e);
      this.removeGamePad(e.gamepad);
    }
  }
});