export const html = (strings: TemplateStringsArray, ...values: any[]) =>
	String.raw({ raw: strings }, ...values);
