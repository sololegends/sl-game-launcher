
import { DynamicBoolean, DynamicNumber, DynamicProperty, DynamicString } from "./dynamic_property";
import _Vue from "vue";

/**
 * If the prop is a function, returns the resolution of that function,
 * otherwise return the prop
 * @param {*} prop - Property as data or a function
 */
const dynamicProp = function(prop: DynamicProperty, undef?: unknown){
  if(prop === undefined){
    return undef;
  }
  if(typeof prop === "function"){
    return prop();
  }
  return prop;
};

const dynamicBoolean = function(prop: DynamicBoolean, undef?: boolean): boolean{
  return dynamicProp(prop, undef);
};

const dynamicString = function(prop: DynamicString, undef?: string): string{
  return dynamicProp(prop, undef);
};

const dynamicNumber = function(prop: DynamicNumber, undef?: number): number{
  return dynamicProp(prop, undef);
};

export default function(Vue: typeof _Vue): void{
  Vue.prototype.dynamicProp = dynamicProp;
  Vue.prototype.dynamicBoolean = dynamicBoolean;
  Vue.prototype.dynamicString = dynamicString;
  Vue.prototype.dynamicNumber = dynamicNumber;
}
