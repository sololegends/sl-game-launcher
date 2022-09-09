
import { Resize, Ripple } from "vuetify/lib/directives";
import Vuetify, {
  VAlert, VApp, VAppBar, VAppBarNavIcon, VAutocomplete,
  VAvatar, VBadge, VBtn, VCard, VCardActions,
  VCardText, VCardTitle, VDataTable, VDatePicker, VDialog,
  VDivider, VForm, VImg, VList, VListItem,
  VListItemAvatar, VListItemTitle, VMain, VMenu,
  VNavigationDrawer, VProgressCircular, VRow,
  VSelect, VSimpleTable, VSpacer, VStepper, VSwitch, VSystemBar,
  VTab, VTextarea, VTextField, VToolbar
} from "vuetify/lib";
import en from "vuetify/src/locale/en";
import { FontAwesomeIcon } from "@fortawesome/vue-fontawesome";
import Vue from "vue";

Vue.component("font-awesome-icon", FontAwesomeIcon);

Vue.use(Vuetify, {
  components: {
    VAlert, VApp, VAppBar, VAppBarNavIcon, VAutocomplete,
    VAvatar, VBadge, VBtn, VCard, VCardActions,
    VCardText, VCardTitle, VDataTable, VDatePicker, VDialog,
    VDivider, VForm, VImg, VList, VListItem,
    VListItemAvatar, VListItemTitle, VMain, VMenu,
    VNavigationDrawer, VProgressCircular, VRow,
    VSelect, VSimpleTable, VSpacer, VStepper, VSwitch, VSystemBar,
    VTab, VTextarea, VTextField, VToolbar
  },
  directives: {
    Ripple, Resize
  }
});
// Vuetify Modals plugin
Vue.prototype.$modal = {
  _cont: new Vue(),
  show: function(name, params){
    this._cont.$emit("toggle", name, true, params);
  },
  hide: function(name, params){
    this._cont.$emit("toggle", name, false, params);
  }
};

// Vuetify Validation Rules
Vue.prototype.$rules = {
  required: function(value){
    if(value == null || value === "" || value.length <= 0){
      return "Required.";
    }return true;
  },
  required_simple: value => !!value || "Required.",
  numericMinMax: function(min, max){
    return function(value){
      if(value == null){
        return "Required.";
      } else if(isNaN(parseInt(value))){
        return "Input must be a number";
      } else if(value < min){
        return "Min: " + min;
      } else if(value > max){
        return "Max: " + max;
      }
      return true;
    };
  },
  domain_ip: function(value){
    if(value == null){ return "Required."; }
    const regex = /^([\w-]+[.][-\w.]+[\w]+)$|^((25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/gm;
    if(regex.exec(value) == null){
      return "Must be a valid domain or IPv4 address";
    }
    return true;
  },
  domain: function(value){
    if(value == null){ return "Required."; }
    const regex = /^([\w-]+[.][-\w.]+[\w]+)$/gm;
    if(regex.exec(value) == null){
      return "Must be a valid domain";
    }
    return true;
  },
  lengthExact: function(length){
    return function(value){
      if(value == null){
        return "Required.";
      } else if(value.length !== length){
        return "Length must be: " + length;
      }
      return true;
    };
  },
  lengthMax: function(max, required = false){
    return function(value){
      if(value == null && required){
        return "Required.";
      } else if(value != null && value.length > max){
        return "Maximum Length: " + max;
      }
      return true;
    };
  },
  lengthMinMax: function(min, max, required = true){
    return function(value){
      if(value == null && required){
        return "Required.";
      } else if(value != null && value.length < min){
        return "Minimum Length: " + min;
      } else if(value != null && value.length > max){
        return "Maximum Length: " + max;
      }
      return true;
    };
  },
  required_select_object: function(value){
    // For select components that return objects
    if(Object.keys(value).length === 0){
      return "Required.";
    }return true;
  },
  validUsername: function(value){
    if(value == null){ return "Required."; }
    const regex = /[\\"/[\]:;|=,+*?<>]+/gm;
    if(regex.exec(value) != null){
      return "Username cannot contain the following characters: \" / \\ [ ] : ; | = , + * ? < >";
    }
    return true;
  }
};

/**
 * Uses the given data table and processes what headers should be
 *   allowed to show with the given window width
 * @param {Object} headers - Array of Header objects to manipulate
 * @param {VueComponent} ref - The data table to process / bind to
 */
Vue.prototype.$vuetify_resize = function(headers, ref){
  const BP = {
    "never": 0,
    "xs": 576,
    "sm": 768,
    "md": 992,
    "lg": 1200,
    "xl": 1400,
    "inf": 9999999999
  };
  if(ref === undefined){ return; }
  // Loop through headers
  for(const i in headers){
    const head = headers[i];
    // Check for the width
    if(head.breakpoint === undefined || BP[head.breakpoint] < ref.$el.clientWidth){
      Vue.set(head, "disabled", false);
    }else{
      Vue.set(head, "disabled", true);
    }
  }
};

Vue.prototype.vuetifyRowDblClick = (e, i) => {
  i.expand(!i.isExpanded);
};

Vue.prototype.$data_table_filter = function(value, search, item){
  // Multi match mode
  if(search.includes("|") || search.includes("&")){
    const parts = search.split("|");
    let matched = false;
    for(const i in parts){
      const in_parts = parts[i].split("&");
      let in_matched = true;
      for(const i in in_parts){
        in_matched = in_matched && Vue.prototype.$data_table_filter(value, in_parts[i].trim(), item);
      }
      matched = matched || in_matched;
    }
    return matched;
  }
  // Special cases
  if(search.includes(":")){
    const parts = search.split(":");
    if(item[parts[0]] !== undefined){
      search = parts[1].trim();
      value = item[parts[0]];
      // Check data type
      if(Array.isArray(value)){
        for(const val in value){
          if(value[val].toString().toLocaleLowerCase().indexOf(search.toLocaleLowerCase()) !== -1){
            return true;
          }
        }
      }else if(value !== null && typeof value === "object"){
        if(search.includes(".")){
          search = search.split(".");
          let tmp_obj = value;
          for(const k in search){
            if(k === search.length - 1){
              return tmp_obj.toString().toLocaleLowerCase().indexOf(search[k].toLocaleLowerCase()) !== -1;
            }
            tmp_obj = tmp_obj[search[k]];
            if(tmp_obj === undefined){
              return false;
            }
          }
        }
        if(value.name !== undefined && value.name.toString().toLocaleLowerCase().indexOf(search.toLocaleLowerCase()) !== -1){
          return true;
        }
        if(value.description !== undefined && value.description.toString().toLocaleLowerCase().indexOf(search.toLocaleLowerCase()) !== -1){
          return true;
        }
        if(value.id !== undefined && value.id.toString().toLocaleLowerCase().indexOf(search.toLocaleLowerCase()) !== -1){
          return true;
        }
        return false;
      }else if(value !== null && value.toString().toLocaleLowerCase().indexOf(search.toLocaleLowerCase()) !== -1){
        return true;
      }
      return false;
    }
  }
  // Default sort
  return value != null && search != null && typeof value !== "boolean" &&
    value.toString().toLocaleLowerCase().indexOf(search.toLocaleLowerCase()) !== -1;
};
const opts = {
  lang: {
    locales: { en },
    current: "en"
  },
  icons: {
    iconfont: "faSvg",
    values: {
      calendar: {
        component: FontAwesomeIcon,
        props: {
          icon: [ "fas", "calendar-alt" ]
        }
      },
      clear: {
        component: FontAwesomeIcon,
        props: {
          icon: [ "fas", "times" ]
        }
      },
      link: {
        component: FontAwesomeIcon,
        props: {
          icon: [ "fas", "link" ]
        }
      },
      file_upload: {
        component: FontAwesomeIcon,
        props: {
          icon: [ "fas", "file-upload" ]
        }
      },
      plus: {
        component: FontAwesomeIcon,
        props: {
          icon: [ "fas", "plus" ]
        }
      },
      file: {
        component: FontAwesomeIcon,
        props: {
          icon: [ "fas", "file" ]
        }
      },
      folder: {
        component: FontAwesomeIcon,
        props: {
          icon: [ "fas", "folder" ]
        }
      },
      search: {
        component: FontAwesomeIcon,
        props: {
          icon: [ "fas", "search" ]
        }
      },
      prev: {
        component: FontAwesomeIcon,
        props: {
          icon: [ "fas", "chevron-left" ]
        }
      },
      next: {
        component: FontAwesomeIcon,
        props: {
          icon: [ "fas", "chevron-right" ]
        }
      },
      square_xmark: {
        component: FontAwesomeIcon,
        props: {
          icon: [ "fas", "square-xmark" ]
        }
      }
    }
  },
  theme: {
    dark: "dark",
    options: {
      customProperties: true
    },
    themes: {
      light: {
        // Base theming
        primary: "#3091D3",
        success: "#388E3C",
        "success-bkg": "b1d0b4",
        warning: "#d57e11",
        error: "#CC3333",
        table: "#FFFFFF",
        "main-view": "#DDDDDD",
        "breadcrumbs": "#FFFFFF",
        "v-navigation-drawer": "#FFFFFF",
        "v-stepper": "#FFFFFF",
        // Custom elements
        "data-table-row-even": "#ECECEC",
        "data-table-hover": "#DDDDDD",
        "table-footer-text": "#000",
        "table-page-size": "#212121",
        "app-card-head": "#E5E5E5",
        "app-card-body": "#FFFFFF",
        "app-file-card": "#EEE",
        "app-stat-border": "#DDD",
        "app-details-border": "#D8D8D8",
        "action-icon": "#000",
        "dash-loading-bar": "#1F5487",
        // Stat card highlights
        "highlight-line": "#AAA",
        "highlight-line-dark": "#BBB",
        "highlight-line-black": "#777"
      },
      dark: {
        // Base theming
        primary: "#1F5487",
        success: "#388E3C",
        "success-bkg": "32553f",
        warning: "#d57e11",
        error: "#CC3333",
        table: "#232D35",
        "main-view": "#171E26",
        "breadcrumbs": "#232D35",
        "v-navigation-drawer": "#232D35",
        "v-stepper": "#232D35",
        // Custom elements
        "data-table-row-even": "#263039",
        "data-table-hover": "#3b444c",
        "app-card-head": "#1F2830",
        "app-card-body": "#232D35",
        "app-file-card": "#2f3d48",
        "app-stat-border": "#19222A",
        "app-details-border": "#1F2830",
        "action-icon": "#3091D3",
        "dash-loading-bar": "#3091D3",
        // Stat card highlights
        "highlight-line": "#666",
        "highlight-line-dark": "#333",
        "highlight-line-black": "#111"
      }
    }
  }
};

export default new Vuetify(opts);