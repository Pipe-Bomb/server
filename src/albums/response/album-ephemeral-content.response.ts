import { ApiProperty, ApiSchema } from "@nestjs/swagger";
import { EphemeralSourceResponse } from "src/ephemeral/response/ephemeral-source.response";
import { EphemeralTrackResponse } from "src/ephemeral/response/ephemeral-track.response";

@ApiSchema({ name: "AlbumEphemeralContent" })
export class AlbumEphemeralContentResponse {
	@ApiProperty({
		type: EphemeralSourceResponse,
	})
	source: EphemeralSourceResponse;

	@ApiProperty({
		type: [EphemeralTrackResponse],
	})
	tracks: EphemeralTrackResponse[];
}
