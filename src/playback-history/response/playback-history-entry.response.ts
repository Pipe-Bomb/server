import { ApiProperty, ApiSchema } from "@nestjs/swagger";
import { TrackResponse } from "src/tracks/response/track.response";

@ApiSchema({ name: "PlaybackHistoryEntry" })
export class PlaybackHistoryEntryResponse {
	@ApiProperty({ type: String })
	trackUuid: string;

	@ApiProperty({ type: String, nullable: true })
	pluginId: string | null;

	@ApiProperty({ type: String })
	clientName: string;

	@ApiProperty({ type: Date })
	datePlayed: Date;

	@ApiProperty({ type: Date })
	dateRecorded: Date;

	@ApiProperty({
		type: TrackResponse,
		nullable: true,
	})
	track: TrackResponse | null;
}
