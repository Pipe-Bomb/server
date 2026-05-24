import { ApiProperty, ApiSchema } from "@nestjs/swagger";
import { AlbumResponse } from "src/albums/response/album.response";
import { EphemeralSourceResponse } from "src/ephemeral/response/ephemeral-source.response";
import { EphemeralTrackResponse } from "src/ephemeral/response/ephemeral-track.response";

@ApiSchema({ name: "ArtistEphemeralContent" })
export class ArtistEphemeralContentResponse {
	@ApiProperty({
		type: EphemeralSourceResponse,
	})
	source: EphemeralSourceResponse;

	@ApiProperty({
		type: [EphemeralTrackResponse],
	})
	tracks: EphemeralTrackResponse[];

	@ApiProperty({
		type: [AlbumResponse],
	})
	albums: AlbumResponse[];
}
