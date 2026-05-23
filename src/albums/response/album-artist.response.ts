import { ApiProperty, ApiSchema } from "@nestjs/swagger";
import { ArtistResponse } from "src/artist-manager/response/artist.response";

@ApiSchema({ name: "AlbumArtist" })
export class AlbumArtistResponse {
	@ApiProperty({
		type: "string",
		nullable: true,
	})
	artistUuid: string | null;

	@ApiProperty({
		type: () => ArtistResponse,
	})
	artist: ArtistResponse;

	@ApiProperty({
		type: String,
		nullable: true,
	})
	joinPhrase: string | null;
}
