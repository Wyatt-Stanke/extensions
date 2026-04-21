type Child = Node | string | number | boolean | null | undefined | Child[];

function appendChildren(
	parent: HTMLElement | DocumentFragment,
	children: Child[],
) {
	for (const child of children) {
		if (
			child === null ||
			child === undefined ||
			child === false ||
			child === true
		)
			continue;
		if (Array.isArray(child)) {
			appendChildren(parent, child);
		} else {
			parent.append(typeof child === "object" ? child : String(child));
		}
	}
}

/** JSX factory — compiles `<div>` to real DOM elements. */
export function jsx(
	tag: string,
	props: Record<string, unknown> | null,
	...children: Child[]
): HTMLElement {
	const element = document.createElement(tag);
	if (props) {
		for (const [key, value] of Object.entries(props)) {
			if (key === "className") {
				element.className = value as string;
			} else if (key.startsWith("on") && typeof value === "function") {
				element.addEventListener(
					key[2].toLowerCase() + key.slice(3),
					value as EventListener,
				);
			} else if (typeof value === "boolean") {
				if (value) element.setAttribute(key, "");
			} else if (value !== undefined && value !== null) {
				element.setAttribute(key, String(value));
			}
		}
	}
	appendChildren(element, children);
	return element;
}

/** JSX fragment — renders children without a wrapper element. */
export function Fragment(
	_props: null,
	...children: Child[]
): DocumentFragment {
	const frag = document.createDocumentFragment();
	appendChildren(frag, children);
	return frag;
}
