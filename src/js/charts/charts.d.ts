import { DynamicNumber } from "@/plugins/dynamic_property/dynamic_property";

// Properties
export interface DoughnutProps {
	offset: DynamicNumber
	stroke: number
	size: DynamicNumber
	id: string
	classes: string[]
}

export interface DoughnutPropsStatic {
	radius: number
	circumference: number
}

export interface LCDProps {
	id: string
}

export interface LCDPropsStatic {
	segments: number
	colors: string[]
}

export interface StaticProperties{
	doughnut: DoughnutPropsStatic
	lcd_gauge: LCDPropsStatic
}

export interface DefaultProperties{
	doughnut: DoughnutProps
	lcd_gauge: LCDProps
}

// Mutator Functions
export interface ChartMutator{
	hexToRGB: (color: string) => number[]
	lightenColor: (color: string, level?: number) => string
	darkenColor: (color: string, level?: number) => string
	changeAlpha: (color: string, alpha?: number) => string
}

// Data
export type DoughnutData = {
	name: string
	value: number
	color: string
}

export type LCDData = number


// Full Object
export interface Charts{
	_css_bound: boolean
	_bindCss: () => void
	static_properties: StaticProperties
	default_properties: DefaultProperties
	default_colors: string[]
	mutator: ChartMutator
	doughnut: (data: DoughnutData[], properties?: DoughnutProps) => string
	lcd_gauge: (data: LCDData, properties?: LCDProps) => string
}