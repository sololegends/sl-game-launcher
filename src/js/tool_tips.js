"use strict";

const tool_tips = {
  main_tooltip_target: undefined,
  // Element store
  main_tooltip_wrapper: undefined,
  main_tooltip: undefined,
  // Functions
  init: function(){
    // Enforce only init once
    if(document.getElementById("main_tooltip_wrapper") != null){ return; }
    const tip_element = document.createElement("div");
    tip_element.id = "main_tooltip_wrapper";
    const tip_element_inner = document.createElement("div");
    tip_element_inner.id = "main_tooltip";
    tip_element_inner.classList.add("no-display");
    tip_element_inner.innerText = "x";

    tip_element.appendChild(tip_element_inner);
    document.body.appendChild(tip_element);
    this.main_tooltip_wrapper = tip_element;
    this.main_tooltip = tip_element_inner;

    const that = this;
    // Attach listeners to the body
    document.body.addEventListener("mousemove", function(e){
      that.updateMainTooltip(e.clientX, e.clientY, e.target);
    });
    document.body.addEventListener("mousedown", function(){
      tip_element_inner.classList.add("no-display");
    });
    document.body.addEventListener("wheel", function(e){
      that.updateMainTooltip(e.clientX, e.clientY, e.target);
    });
    document.body.addEventListener("mouseleave", function(e){
      if(e.clientY <= 10 || e.clientX <= 10
        || (e.clientX >= window.innerWidth || e.clientY >= window.innerHeight)){
        that.updateMainTooltip(e.clientX, e.clientY, e.target);
      }
    });
    this.addCSS();
  },
  addCSS: function(){
    const style = document.createElement("style");
    if(document.getElementById("tool_tip_stylesheet_include") != null){ return; }
    style.id = "tool_tip_stylesheet_include";
    style.innerText = "#main_tooltip{"
    + "  top:17px;"
    + "  left:13px;"
    + "  white-space: nowrap;"
    + "  position: absolute;"
    + "  z-index: 10000001;"
    + "  background: rgba(68,68,68,0.85);"
    + "  color: #eee;"
    + "  padding: 5px 9px;"
    + "  border-radius: 7px;"
    + "  font-size: 14px;"
    + "  font-family: sans-serif,monospace;"
    + "  box-shadow: 1px 1px 2px 0px rgba(0, 0, 0, 0.8);"
    + "  pointer-events: none;"
    + " -webkit-user-select:none;-moz-user-select:none;-ms-user-select:none;user-select:none;"
    + "}"
    + "#main_tooltip.size-lock{width: 400px;white-space: normal;word-break: break-word;}"
    + "#main_tooltip.left{right: 8px;left:unset;}"
    + "#main_tooltip.up{top: unset;bottom: 2px;}"
    + "#main_tooltip.tooltip-error{color: #ffa3a3;}"
    + "#main_tooltip_wrapper{position:absolute;}";
    document.body.appendChild(style);
  },
  spacedText: function(text, ele){
    if(text !== undefined){
      // Console.log(text);
      ele.innerText = "";
      const separated = text.split("\n");
      if(separated.length === 1){
        ele.innerText = text;
      }else{
        separated.forEach(function(seg){
          const div = document.createElement("div");
          div.innerText = seg;
          if(seg.length === 0){
            div.innerHTML = "<br>";
          }
          ele.appendChild(div);
        });
      }
      return ele;
    }
  },
  updateMainTooltip: function(x, y, target){
    // Adjust y for scroll position
    y = y + document.scrollingElement.scrollTop;
    x = x + document.scrollingElement.scrollLeft;
    if(target == null){
      target = this.main_tooltip_target;
    }

    if(target == null || target === document.body){
      this.main_tooltip.classList.add("no-display");
      return;
    }

    let target_text = "";
    let tt_error = false;

    if(typeof target === "string"){
      target_text = target;
    }else{
      // Get the closest tip-title if the current target doesn't have it
      if(target.getAttribute("tip-title") == null){
        target = target.closest("[tip-title]");
        if(target == null){
          this.main_tooltip.classList.add("no-display");
          return;
        }
        this.main_tooltip_target = target;
      }

      // Get the text
      if(target.getAttribute("tip-title") !== undefined){
        target_text = target.getAttribute("tip-title");
      }
      // Get if the tooltip would be error styled
      tt_error = target.classList.contains("tip-title-error");
    }

    // Style it errored
    this.main_tooltip.classList.remove("tooltip-error");
    if(tt_error){
      this.main_tooltip.classList.add("tooltip-error");
    }

    // Use the current position if no position is given
    if(x === undefined){
      x = this.main_tooltip_wrapper.getAttribute("left");
    }
    if(y === undefined){
      y = this.main_tooltip_wrapper.getAttribute("top");
    }
    // Store positions as attr to avoid changing the position and triggering a reflow
    this.main_tooltip_wrapper.setAttribute("left", x);
    this.main_tooltip_wrapper.setAttribute("top", y);

    // Determine if the tooltip should be shown
    if(target_text.length){
      this.main_tooltip.classList.remove("no-display");
    }else{
      this.main_tooltip.classList.add("no-display");
      return;
    }

    this.main_tooltip.classList.remove("size-lock");
    this.main_tooltip_wrapper.style.left = x + "px";
    this.main_tooltip_wrapper.style.top = y + "px";
    this.spacedText(target_text, this.main_tooltip);

    // Test massive(if width is larger than 2/3 the window)
    let tt_width = this.main_tooltip.offsetWidth;
    let tt_height = this.main_tooltip.offsetHeight;
    if(tt_width > document.body.offsetWidth * 0.5){
      // Apply a size lock to prevent it from going off the window
      this.main_tooltip.classList.add("size-lock");
    }

    // Test edge
    tt_width = this.main_tooltip.offsetWidth;
    tt_height = this.main_tooltip.offsetHeight;
    if(x + tt_width + 40 > document.body.offsetWidth){
      // It's past the right edge, switch to left of mouse
      this.main_tooltip.classList.add("left");
    }else{
      // No change necessary
      this.main_tooltip.classList.remove("left");
    }
    if(y + tt_height + 40 > document.body.offsetHeight){
      // It's past the bottom edge, switch to up
      this.main_tooltip.classList.add("up");
    }else{
      this.main_tooltip.classList.remove("up");
    }
  }
};

/* global exports */
exports.tool_tips = tool_tips;
Object.defineProperty(exports, "__esModule", { value: true });