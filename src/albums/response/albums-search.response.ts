import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { AlbumResponse } from "./album.response";

export class AlbumsSearchResponse {
	@ApiProperty({
		type: [AlbumResponse],
	})
	albums: AlbumResponse[];

	@ApiProperty({ type: Number, nullable: true })
	totalPages: number | null;
}
