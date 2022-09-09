
import _Vue from "vue";

/**
 * Removes an element from the given array
 * @param {Array} array - The array to operate on
 * @param {any} element - The element to remove from the given array
 */
const arrayRemove = function(array: unknown[], element: unknown): void{
  array.splice(array.indexOf(element), 1);
};

/**
 * Compares the two arrays, sorted and checks if they are the same
 * @param array_a {*} - Array to compare
 * @param array_b {*} - Array to compare to
 */
const arrayEqualityCheck = function(array_a: unknown[], array_b: unknown[]): boolean{
  const array_a_copy = [...array_a];
  const array_b_copy = [...array_b];

  if(array_a_copy.length !== array_b_copy.length){ return false; }

  array_a_copy.sort();
  array_b_copy.sort();

  for (let i = 0; i < array_a_copy.length; ++i){
    if (array_a_copy[i] !== array_b_copy[i]){ return false; }
  }
  return true;
};

export default function(Vue: typeof _Vue): void{
  Vue.prototype.arrayRemove = arrayRemove;
  Vue.prototype.arrayEqualityCheck = arrayEqualityCheck;
}

declare module "vue/types/vue" {
  interface Vue {
    arrayRemove: (array: unknown[], element: unknown) => void
    arrayEqualityCheck: (array_a: unknown[], array_b: unknown) => boolean
  }
}