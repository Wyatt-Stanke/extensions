declare module "*.css" {
	const content: string;
	export default content;
}
declare module "*.html" {
	const content: string;
	export default content;
}

declare namespace JSX {
	type Element = HTMLElement;
	interface IntrinsicElements {
		[tag: string]: Record<string, unknown>;
	}
}
