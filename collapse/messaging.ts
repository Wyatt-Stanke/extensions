import { createMessenger } from "../shared/messaging";

export enum CollapseMessageType {
	COLLAPSE_GET_VIDEO_INFO = "COLLAPSE_GET_VIDEO_INFO",
	COLLAPSE_VIDEO_INFO = "COLLAPSE_VIDEO_INFO",
	GET_VIDEO_INFO = "GET_VIDEO_INFO",
	COLLAPSE_TABS = "COLLAPSE_TABS",
	GET_LISTS = "GET_LISTS",
	ADD_TO_LIST = "ADD_TO_LIST",
	OPEN_VIDEO = "OPEN_VIDEO",
	DELETE_VIDEO = "DELETE_VIDEO",
	DELETE_LIST = "DELETE_LIST",
	RENAME_LIST = "RENAME_LIST",
	MERGE_LISTS = "MERGE_LISTS",
	SHOW_PALETTE = "SHOW_PALETTE",
	IMPORT_LISTS = "IMPORT_LISTS",
}

export type VideoInfo = {
	videoId: string;
	url: string;
	title: string;
	channelName: string;
	thumbnailUrl: string;
	currentTime: number;
	duration: number;
	playlistId: string | null;
	playlistIndex: string | null;
	addedAt?: number;
};

export type VideoList = {
	id: string;
	name: string;
	createdAt: number;
	videos: VideoInfo[];
};

export type CollapseProtocol = {
	[CollapseMessageType.COLLAPSE_GET_VIDEO_INFO]: {
		request: { type: CollapseMessageType.COLLAPSE_GET_VIDEO_INFO };
	};
	[CollapseMessageType.COLLAPSE_VIDEO_INFO]: {
		request: { type: CollapseMessageType.COLLAPSE_VIDEO_INFO; data: VideoInfo };
	};
	[CollapseMessageType.GET_VIDEO_INFO]: {
		request: { type: CollapseMessageType.GET_VIDEO_INFO };
		response: { data: VideoInfo | null };
	};
	[CollapseMessageType.COLLAPSE_TABS]: {
		request: { type: CollapseMessageType.COLLAPSE_TABS; allTabs?: boolean };
		response: {
			success: boolean;
			error?: string;
			listId?: string;
			count?: number;
		};
	};
	[CollapseMessageType.GET_LISTS]: {
		request: { type: CollapseMessageType.GET_LISTS };
		response: { lists: VideoList[] };
	};
	[CollapseMessageType.ADD_TO_LIST]: {
		request: {
			type: CollapseMessageType.ADD_TO_LIST;
			listId: string | null;
			allTabs?: boolean;
		};
		response: {
			success: boolean;
			listId?: string;
			count?: number;
			error?: string;
		};
	};
	[CollapseMessageType.OPEN_VIDEO]: {
		request: {
			type: CollapseMessageType.OPEN_VIDEO;
			listId: string;
			videoId: string;
		};
	};
	[CollapseMessageType.DELETE_VIDEO]: {
		request: {
			type: CollapseMessageType.DELETE_VIDEO;
			listId: string;
			videoId: string;
		};
	};
	[CollapseMessageType.DELETE_LIST]: {
		request: { type: CollapseMessageType.DELETE_LIST; listId: string };
	};
	[CollapseMessageType.RENAME_LIST]: {
		request: {
			type: CollapseMessageType.RENAME_LIST;
			listId: string;
			name: string;
		};
	};
	[CollapseMessageType.MERGE_LISTS]: {
		request: {
			type: CollapseMessageType.MERGE_LISTS;
			targetId: string;
			sourceId: string;
		};
		response: { success: boolean };
	};
	[CollapseMessageType.SHOW_PALETTE]: {
		request: {
			type: CollapseMessageType.SHOW_PALETTE;
			lists: VideoList[];
		};
		response: { success: boolean; listId?: string };
	};
	[CollapseMessageType.IMPORT_LISTS]: {
		request: {
			type: CollapseMessageType.IMPORT_LISTS;
			lists: VideoList[];
		};
		response: { imported: number };
	};
};

export const { sendMessage, sendTabMessage, onMessage } =
	createMessenger<CollapseProtocol>();
