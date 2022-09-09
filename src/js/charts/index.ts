import { ChartMutator, Charts, DoughnutData, DoughnutProps, DoughnutPropsStatic, LCDData, LCDProps, LCDPropsStatic } from "./charts";

const charts = {
  _css_bound: false,
  _bindCss: function(){
    if(this._css_bound){ return; }
    if(document.getElementById("charts_stylesheet_include") != null){ return; }
    const style = document.createElement("style");
    style.id = "charts_stylesheet_include";
    style.innerText = ""
    + "@-webkit-keyframes chart-doughnut-animation {from {stroke-dashoffset: " + this.static_properties.doughnut.circumference + ";}}"
    + "@keyframes chart-doughnut-animation {from {stroke-dashoffset: " + this.static_properties.doughnut.circumference + ";}}"
    + ".charts-doughnut circle{"
    + "  stroke-dasharray: " + this.static_properties.doughnut.circumference + "; "
    + "  stroke-dashoffset: " + this.static_properties.doughnut.circumference + "; "
    + "  -webkit-animation: chart-doughnut-animation 1s ease-out forwards;"
    + "  animation: chart-doughnut-animation 1s ease-out forwards;"
    + "}"
    + ".charts-lcd-gauge-segment>div{"
    + "  height:20px;border-radius:4px;border:1px solid rgba(0,0,0,0.25)"
    + "}"
    + "table.charts-lcd_gauge{"
    + "  height:20px;"
    + "}"
    + ";";
    document.body.appendChild(style);
    this._css_bound = true;
  },
  // Properties
  static_properties: {
    doughnut: {
      radius: 64,
      circumference: Math.round(2 * Math.PI * 64)
    } as DoughnutPropsStatic,
    lcd_gauge: {
      segments: 20,
      /* eslint for-direction: "error" */
      colors: [
        // Green
        "#37872d",
        // Green
        "#37872d",
        // L_green
        "#5bb350",
        // Yellow
        "#d6cd51",
        // Orange
        "#fa6400",
        // Red
        "#f2495c"
      ]
    } as LCDPropsStatic
  },
  default_properties: {
    doughnut: {
      offset: function(){
        return ((charts.static_properties.doughnut.radius * 2) + (charts.default_properties.doughnut.stroke * 2)) / 2;
      },
      stroke: 45,
      size: function(){
        return (charts.static_properties.doughnut.radius * 2) + (charts.default_properties.doughnut.stroke * 2);
      },
      id: "doughnut_" + Date.now(),
      classes: []
    } as DoughnutProps,
    lcd_gauge: {
      id: "lcd_gauge_" + Date.now()
    } as LCDProps
  },

  default_colors: [
    // Aqua Marine
    "#27c272",
    // Burnt Orange
    "#cf712d",
    // Forest Green
    "#54AB43",
    // Muted Red
    "#cf2d2d",
    // Bold Blue
    "#1F78C1",
    // Yellow Mustard
    "#a9b826",
    // Aqua Marine
    "#27c272",
    // Muted Cyan
    "#2aafc9",
    // Deep Purple
    "#864db3",
    // Magenta
    "#c726c4"
  ],

  mutator: {
    hexToRGB: function(color: string): number[]{
      // Parse color
      return [
        parseInt(color.slice(1, 3), 16), parseInt(color.slice(3, 5), 16), parseInt(color.slice(5, 7), 16)
      ];
    },
    lightenColor: function(color: string, level = 32): string{
      // Parse color
      const rgb = charts.mutator.hexToRGB(color);

      return "#"
      + Math.min((rgb[0] + level), 255).toString(16)
      + Math.min((rgb[1] + level), 255).toString(16)
      + Math.min((rgb[2] + level), 255).toString(16);
    },
    darkenColor: function(color: string, level = 100): string{
      // Parse color
      const rgb = charts.mutator.hexToRGB(color);

      return "#"
      + Math.max((rgb[0] - level), 0).toString(16).padStart(2, "0")
      + Math.max((rgb[1] - level), 0).toString(16).padStart(2, "0")
      + Math.max((rgb[2] - level), 0).toString(16).padStart(2, "0");
    },
    changeAlpha: function(color: string, alpha = 0.75): string{
      const rgb = charts.mutator.hexToRGB(color);
      return "rgba(" + rgb.join(",") + "," + alpha + ")";
    }
  } as ChartMutator

} as Charts;

// CHART FUNCTIONS
export function doughnut(data = [] as DoughnutData[], properties = {} as DoughnutProps): string{
  charts._bindCss();
  const options = {
    ...charts.default_properties.doughnut,
    ...properties,
    ...charts.static_properties.doughnut
  };
  if(typeof (options.size) === "function"){ options.size = options.size(); }
  if(typeof (options.offset) === "function"){ options.offset = options.offset(); }
  let total = 0;
  // Calculate data ratio
  for(const i in data){
    const d = data[i];
    total += d.value;
  }
  // Sort data
  // Data.sort(function(e1, e2){
  //   Return e2.value - e1.value;
  // });

  // Generate the graph
  // Outer container
  let element = "<div id=\"" + options.id + "\" class=\"" + options.classes.join(" ") + " charts-doughnut\">";
  // Generate SVG Container
  element += "<svg width=\"" + options.size + "\" height=\"" + options.size + "\" style=\"transform: rotate(-90deg);\"><g>";

  // Add data now!
  // Tracks default color position
  let c = 0;
  let last_ratio = 0;
  let inside = "";
  for(const i in data){
    const d = data[i];
    const ratio = last_ratio + d.value / total;
    last_ratio = ratio;
    inside = "<circle id=\"doughnut_" + d.name + "\" r=\"" + options.radius
      + "\" cy=\"" + options.offset + "\" cx=\"" + options.offset
      + "\" stroke-width=\"" + options.stroke + "\" stroke=\"" + (d.color === undefined ? charts.default_colors[c++] : d.color)
      + "\" style=\"stroke-dashoffset: " + (options.circumference - Math.round(options.circumference * ratio)) + ";\""
      + "\" fill=\"none\"/>" + inside;
  }
  element += inside;
  // Close SVG
  element += "</g></svg>";
  // Close container
  element += "</div>";

  return element;
}

export function lcd_gauge(value: LCDData, properties = {} as LCDProps): string{
  charts._bindCss();
  const options = {
    ...charts.default_properties.lcd_gauge,
    ...properties,
    ...charts.static_properties.lcd_gauge
  };

  let element = "<table id=\"" + options.id + "\" class=\"charts-lcd_gauge\" title=\"" + value + "%\"><tr>";

  const ratio = options.segments / (options.colors.length - 1);
  // Build segments
  for(let i = 0; i < options.segments; i++){
    let color = options.colors[Math.round(i / ratio)];
    element += "<td class=\"charts-lcd-gauge-segment\">";
    if((value / 5) > i){
      element += "<div style=\"background:linear-gradient("
        + "0deg, " + color + " 0%, " + charts.mutator.lightenColor(color, 40) + " 50%, " + color + " 100%"
        + ");\"></div>";
    }else{
      color = charts.mutator.changeAlpha(charts.mutator.darkenColor(color), 0.25);
      element += "<div style=\"border-color:rgba(102,102,102,0.5);"
        + "background:linear-gradient(0deg, " + color + " 0%, " + color + " 100%);\"></div>";
    }
    +"</td>";
  }

  return element + "</tr></table>";
}

export default {
  lcd_gauge,
  doughnut
};