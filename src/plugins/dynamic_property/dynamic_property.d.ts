
export type DynamicProperty = unknown | (() => unknown);
export type DynamicBoolean = boolean | (() => boolean);
export type DynamicString = string | (() => string);
export type DynamicNumber = number | (() => number);

export default typeof DynamicProperty;


declare module "vue/types/vue" {
  interface Vue {
    dynamicProp: (prop: DynamicProperty, undef?: unknown) => unknown
    dynamicBoolean: (prop: DynamicBoolean, undef?: boolean) => boolean
    dynamicString: (prop: DynamicString, undef?: string) => string
    dynamicNumber: (prop: DynamicNumber, undef?: number) => number
  }
}