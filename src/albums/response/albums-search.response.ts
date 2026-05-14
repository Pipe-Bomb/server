import { ApiProperty } from "@nestjs/swagger";
import { AlbumResponse } from "./album.response";

export class AlbumsSearchResponse {
	@ApiProperty({
		type: [AlbumResponse],
	})
	albums: AlbumResponse[];
}
