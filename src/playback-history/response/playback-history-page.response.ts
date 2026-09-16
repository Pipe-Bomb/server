import { ApiProperty, ApiSchema } from "@nestjs/swagger";
import { PlaybackHistoryEntryResponse } from "./playback-history-entry.response";

@ApiSchema({ name: "PlaybackHistoryPage" })
export class PlaybackHistoryPageResponse {
	@ApiProperty({
		type: [PlaybackHistoryEntryResponse],
	})
	entries: PlaybackHistoryEntryResponse[];

	@ApiProperty({
		type: "integer",
	})
	total: number;
}
