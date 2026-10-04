import { ApiProperty, ApiSchema } from "@nestjs/swagger";
import { ArtistResponse } from "src/artist-manager/response/artist.response";

@ApiSchema({ name: "SavedArtists" })
export class SavedArtistsResponse {
	@ApiProperty({
		type: [ArtistResponse],
	})
	artists: ArtistResponse[];

	@ApiProperty({ type: Number })
	total: number;
}
