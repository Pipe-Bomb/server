import { AttributeValue } from "./attribute";
import { SavedPlaylist, SavedPlaylistMember } from "./database";

export interface PlaylistClient {
	getUserPlaylistUuids(uuid: string): Promise<string[]>;

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
	}): Promise<string>;

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

	getPlaylistMembers(playlistUuid: string): Promise<SavedPlaylistMember[]>;
}
