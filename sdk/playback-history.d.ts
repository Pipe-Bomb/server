export interface PlaybackHistoryEntry {
	userUuid: string;
	trackUuid: string;
	pluginId: string | null;
	clientName: string;
	datePlayed: Date;
	dateRecorded: Date;
}

export interface PlaybackHistoryClient {
	addHistoryEntry(
		trackUuid: string,
		userUuid: string,
		clientName: string,
		datePlayed: Date,
	): Promise<void>;
	getUserHistory(
		userUuid: string,
		options: {
			amount: number;
			offset?: number;
			pluginId?: string | null;
			clientName?: string;
		},
	): Promise<{
		entries: PlaybackHistoryEntry[];
		total: number;
	}>;
}
