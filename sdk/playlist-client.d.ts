import { AttributeValue } from "./attribute";
import { SavedPlaylist, SavedPlaylistMember } from "./database";

export interface PlaylistBotInfo {
	id: string;
	name: string;
}

export interface PlaylistPluginBot {
	pluginId: string;
	botId: string;
	botName: string;
}

export interface ReadOnlyPlaylistClient {
	getUserPlaylistUuids(uuid: string): Promise<string[]>;
	getMemberPlaylistUuids(userUuid: string): Promise<string[]>;
	getBotPlaylistUuids(
		pluginId: string,
		botId: string | null,
	): Promise<string[]>;
	getPublicPlaylistUuids(): Promise<string[]>;
	getPlaylistBots(): PlaylistPluginBot[];

	getPlaylist(
		uuid: string,
		options?: {
			relations?: {
				attributes?: boolean;
				filterGroups?: boolean;
				owner?: boolean;
				tracks?:
					| {
							addedBy?: boolean;
							track?:
								| {
										identities?: boolean;
										attributes?: boolean;
										artists?: {
											identities?: boolean;
											attributes?: boolean;
										};
								  }
								| boolean;
					  }
					| boolean;
			};
		},
	): Promise<SavedPlaylist | null>;

	getPlaylistMembers(playlistUuid: string): Promise<SavedPlaylistMember[]>;
}

export interface WritablePlaylistClient extends ReadOnlyPlaylistClient {
	addToPlaylist(
		uuid: string,
		trackUuids: string[],
		options?: {
			asUser?: string;
		},
	): Promise<void>;

	removeFromPlaylist(
		uuid: string,
		trackUuids: string[],
		options?: {
			asUser?: string;
		},
	): Promise<void>;

	createPlaylist(options?: {
		ownerUuid?: string;
		attributes?: {
			sourceId: string | null;
			attributes: AttributeValue[];
		};
		visibility?: "private" | "unlisted" | "public";
	}): Promise<string>;

	updatePlaylistVisibility(
		uuid: string,
		visibility: "private" | "unlisted" | "public",
	): Promise<void>;

	deletePlaylist(
		uuid: string,
		options?: {
			asUser?: string;
		},
	): Promise<void>;

	updatePlaylistAttributes(
		uuid: string,
		attributeSourceId: string | null,
		attributes: AttributeValue[],
		options?: {
			asUser?: string;
		},
	): Promise<void>;

	addPlaylistMember(
		playlistUuid: string,
		userUuid: string,
		role: "collaborator" | "viewer",
	): Promise<void>;

	removePlaylistMember(playlistUuid: string, userUuid: string): Promise<void>;
}
