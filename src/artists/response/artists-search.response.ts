import { ApiProperty } from "@nestjs/swagger";
import { ArtistResponse } from "../../artist-manager/response/artist.response";

export class ArtistsSearchResponse {
	@ApiProperty({
		type: [ArtistResponse],
	})
	artists: ArtistResponse[];
}
