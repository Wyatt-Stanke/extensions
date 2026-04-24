import { createMessenger } from "../shared/messaging";

export enum ApMessageType {
	AP_TOOLS_GET_STATE = "AP_TOOLS_GET_STATE",
	AP_TOOLS_STATE = "AP_TOOLS_STATE",
	AP_TOOLS_LOCALE_STRINGS = "AP_TOOLS_LOCALE_STRINGS",
	STATE_UPDATE = "STATE_UPDATE",
	GET_STATE = "GET_STATE",
	CLICK_BUTTON = "CLICK_BUTTON",
	SET_OVERLAY_VISIBLE = "SET_OVERLAY_VISIBLE",
}

export type ApState = {
	initialized: boolean;
	videoId: string | null;
	blocking: string[];
};

export type ApProtocol = {
	[ApMessageType.AP_TOOLS_GET_STATE]: {
		request: { type: ApMessageType.AP_TOOLS_GET_STATE };
	};
	[ApMessageType.AP_TOOLS_STATE]: {
		request: { type: ApMessageType.AP_TOOLS_STATE; state: ApState };
	};
	[ApMessageType.AP_TOOLS_LOCALE_STRINGS]: {
		request: {
			type: ApMessageType.AP_TOOLS_LOCALE_STRINGS;
			strings: Record<string, string>;
		};
	};
	[ApMessageType.STATE_UPDATE]: {
		request: { type: ApMessageType.STATE_UPDATE; state: ApState };
	};
	[ApMessageType.GET_STATE]: {
		request: { type: ApMessageType.GET_STATE };
		response: { state: ApState };
	};
	[ApMessageType.CLICK_BUTTON]: {
		request: { type: ApMessageType.CLICK_BUTTON };
	};
	[ApMessageType.SET_OVERLAY_VISIBLE]: {
		request: { type: ApMessageType.SET_OVERLAY_VISIBLE; visible: boolean };
	};
};

export const { sendMessage, sendTabMessage, onMessage } =
	createMessenger<ApProtocol>();
