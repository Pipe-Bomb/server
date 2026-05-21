import { ApiProperty, ApiSchema } from "@nestjs/swagger";
import { AlbumResponse } from "src/albums/response/album.response";
import { ArtistResponse } from "src/artist-manager/response/artist.response";
import { TrackResponse } from "src/tracks/response/track.response";

@ApiSchema({ name: "SearchResults" })
export class SearchResultsResponse {
	@ApiProperty({
		type: [TrackResponse],
	})
	tracks: TrackResponse[];

	@ApiProperty({
		type: [ArtistResponse],
	})
	artists: ArtistResponse[];

	@ApiProperty({
		type: [AlbumResponse],
	})
	albums: AlbumResponse[];
}
