import { ApiProperty, ApiSchema } from "@nestjs/swagger";
import { EphemeralTrackResponse } from "./ephemeral-track.response";
import { ArtistResponse } from "src/artist-manager/response/artist.response";
import { AlbumResponse } from "src/albums/response/album.response";

@ApiSchema({ name: "EphemeralSearchResults" })
export class EphemeralSearchResultsResponse {
	@ApiProperty({
		type: [EphemeralTrackResponse],
	})
	tracks: EphemeralTrackResponse[];

	@ApiProperty({
		type: [ArtistResponse],
	})
	artists: ArtistResponse[];

	@ApiProperty({
		type: [AlbumResponse],
	})
	albums: AlbumResponse[];
}
