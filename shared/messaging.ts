export type MessageDefinition = {
	request: { type: string; [key: string]: unknown };
	response?: unknown;
};

export type ProtocolMap = Record<string, MessageDefinition>;

// biome-ignore lint/suspicious/noConfusingVoidType: Allow void response types for messages that don't expect a response
export type VoidIfUndefined<T> = T extends undefined ? void : T;

export function createMessenger<Protocol extends ProtocolMap>() {
	return {
		sendMessage<T extends keyof Protocol>(
			message: Protocol[T]["request"],
		): Promise<VoidIfUndefined<Protocol[T]["response"]>> {
			return chrome.runtime.sendMessage(message);
		},

		sendTabMessage<T extends keyof Protocol>(
			tabId: number,
			message: Protocol[T]["request"],
		): Promise<VoidIfUndefined<Protocol[T]["response"]>> {
			return chrome.tabs.sendMessage(tabId, message);
		},

		onMessage<T extends keyof Protocol>(
			type: T,
			handler: (
				message: Protocol[T]["request"],
				sender: chrome.runtime.MessageSender,
			) =>
				| Promise<VoidIfUndefined<Protocol[T]["response"]>>
				| VoidIfUndefined<Protocol[T]["response"]>,
		) {
			const listener = (
				message: unknown,
				sender: chrome.runtime.MessageSender,
				sendResponse: (response: unknown) => void,
			) => {
				if (
					message !== null &&
					typeof message === "object" &&
					"type" in message &&
					message.type === type
				) {
					const result = handler(message as Protocol[T]["request"], sender);
					if (result instanceof Promise) {
						result.then(sendResponse);
						return true;
					} else {
						sendResponse(result);
						return false;
					}
				}
				return false;
			};
			chrome.runtime.onMessage.addListener(listener);
			return listener;
		},
	};
}
