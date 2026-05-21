import { ApiProperty, ApiSchema } from "@nestjs/swagger";
import { ArtistResponse } from "src/artist-manager/response/artist.response";

@ApiSchema({ name: "TrackArtist" })
export class TrackArtistResponse {
	@ApiProperty()
	artistUuid: string;

	@ApiProperty({
		type: ArtistResponse,
	})
	artist: ArtistResponse;

	@ApiProperty({
		type: String,
		nullable: true,
	})
	joinPhrase: string | null;
}
