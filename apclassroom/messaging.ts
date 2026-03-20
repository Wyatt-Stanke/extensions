import { createMessenger } from "../shared/messaging";

export enum ApMessageType {
	AP_TOOLS_GET_STATE = "AP_TOOLS_GET_STATE",
	AP_TOOLS_STATE = "AP_TOOLS_STATE",
	STATE_UPDATE = "STATE_UPDATE",
	GET_STATE = "GET_STATE",
}

export type ApState = {
	initialized: boolean;
	videoId: string | null;
	blocking: string[];
};

export type ApProtocol = {
	[ApMessageType.AP_TOOLS_GET_STATE]: {
		request: { type: ApMessageType.AP_TOOLS_GET_STATE };
		response: void;
	};
	[ApMessageType.AP_TOOLS_STATE]: {
		request: { type: ApMessageType.AP_TOOLS_STATE; state: ApState };
		response: void;
	};
	[ApMessageType.STATE_UPDATE]: {
		request: { type: ApMessageType.STATE_UPDATE; state: ApState };
		response: void;
	};
	[ApMessageType.GET_STATE]: {
		request: { type: ApMessageType.GET_STATE };
		response: { state: ApState };
	};
};

export const { sendMessage, sendTabMessage, onMessage } =
	createMessenger<ApProtocol>();
