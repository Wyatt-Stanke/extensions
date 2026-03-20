export type MessageDefinition = {
  request: { type: string; [key: string]: any };
  response: any;
};

export type ProtocolMap = Record<string, MessageDefinition>;

export function createMessenger<Protocol extends ProtocolMap>() {
  return {
    sendMessage<T extends keyof Protocol>(
      message: Protocol[T]["request"]
    ): Promise<Protocol[T]["response"]> {
      return chrome.runtime.sendMessage(message);
    },

    sendTabMessage<T extends keyof Protocol>(
      tabId: number,
      message: Protocol[T]["request"]
    ): Promise<Protocol[T]["response"]> {
      return chrome.tabs.sendMessage(tabId, message);
    },

    onMessage<T extends keyof Protocol>(
      type: T,
      handler: (
        message: Protocol[T]["request"],
        sender: chrome.runtime.MessageSender
      ) => Promise<Protocol[T]["response"]> | Protocol[T]["response"]
    ) {
      const listener = (
        message: any,
        sender: chrome.runtime.MessageSender,
        sendResponse: (response: any) => void
      ) => {
        if (message?.type === type) {
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

