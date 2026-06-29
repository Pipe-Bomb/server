import { SavedPlaylist } from "./database";

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
}
