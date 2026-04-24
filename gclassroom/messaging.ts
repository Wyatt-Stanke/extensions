import { createMessenger } from "../shared/messaging";

// Empty for now, as we mainly use chrome.storage as the source of truth
export enum GCMessageType {}

export type GCProtocol = Record<string, never>;

export const { sendMessage, sendTabMessage, onMessage } =
	createMessenger<GCProtocol>();
