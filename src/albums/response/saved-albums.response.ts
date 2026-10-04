import { ApiProperty, ApiSchema } from "@nestjs/swagger";
import { AlbumResponse } from "./album.response";

@ApiSchema({ name: "SavedAlbums" })
export class SavedAlbumsResponse {
	@ApiProperty({
		type: [AlbumResponse],
	})
	albums: AlbumResponse[];

	@ApiProperty({ type: Number })
	total: number;
}
