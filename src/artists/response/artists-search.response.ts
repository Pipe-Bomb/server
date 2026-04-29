import { ApiProperty } from "@nestjs/swagger";
import { ArtistResponse } from "./artist.response";

export class ArtistsSearchResponse {
	@ApiProperty({
		type: [ArtistResponse],
	})
	artists: ArtistResponse[];
}
