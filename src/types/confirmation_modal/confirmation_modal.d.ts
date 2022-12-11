

declare module "confirmation_modal"{
	export namespace GeneralPopup {
		export type InputType = "button" | "checkbox" | "color" | "date" | "datetime-local"
		| "email" | "file" | "hidden" | "image" | "month" | "number"
		| "password" | "radio" | "range" | "reset" | "search" | "submit"
		| "tel" | "text" | "time" | "url" | "week";
		export interface PromptOptions {
			show_cancel?: boolean,
			header?: string,
			input_min?: number | undefined,
			input_max?: number | undefined,
			placeholder?: string | undefined,
			type?: InputType,
			submit_text?: string | undefined,
			rules?: ((value: string | null) => boolean | string)[]
		}
		export interface PromptOptionsInternal extends PromptOptions {
			show_cancel: boolean,
			header: string,
			input_min: number | undefined,
			input_max: number | undefined,
			placeholder: string | undefined,
			type: InputType,
			submit_text: string | undefined,
			rules: ((value: string | null) => boolean | string)[]
		}
		export interface ConfirmOptions {
			show_cancel?: boolean,
			header?: string
		}
		export interface ConfirmOptionsInternal extends ConfirmOptions {
			show_cancel: boolean,
			header: string
		}

		export interface QuestionButton {
			text: string,
			id?: string,
			hover?: string
		}
		export interface QuestionOptions {
			buttons?: QuestionButton[],
			header?: string
		}
		export interface QuestionOptionsInternal extends QuestionOptions {
			buttons: QuestionButton[],
			header: string
		}

		export interface ConfirmModal extends Vue{
			open: GeneralPopup.ConfirmFn
		}
		export interface PromptModal extends Vue{
			open: GeneralPopup.PromptFn
		}
		export interface QuestionModal extends Vue{
			open: GeneralPopup.QuestionFn
		}

		export type ConfirmFn = (message: string, title: string, options?: GeneralPopup.ConfirmOptions) => Promise<boolean | string>
		export type PromptFn = (message: string, title: string, options?: GeneralPopup.PromptOptions) => Promise<string>
		export type QuestionFn = (message: string, title: string, options?: GeneralPopup.QuestionOptions) => Promise<string>
	}
}
