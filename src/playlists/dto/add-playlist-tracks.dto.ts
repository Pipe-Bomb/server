import { Type } from "class-transformer";
import { IsArray, ValidateIf, ValidateNested } from "class-validator";
import { ApiProperty } from "@nestjs/swagger";
import { NewPlaylistAlbumDto } from "./new-playlist-album.dto";
import { TrackIdDto } from "src/tracks/dto/track-id.dto";

export class AddPlaylistTracksDto {
	@ValidateIf((_, value) => value !== null)
	@IsArray()
	@Type(() => TrackIdDto)
	@ValidateNested({ each: true })
	@ApiProperty({
		type: [TrackIdDto],
		nullable: true,
	})
	tracks: TrackIdDto[] | null;

	@ValidateIf((_, value) => value !== null)
	@IsArray()
	@Type(() => NewPlaylistAlbumDto)
	@ValidateNested({ each: true })
	@ApiProperty({
		type: [NewPlaylistAlbumDto],
		nullable: true,
	})
	albums: NewPlaylistAlbumDto[] | null;
}
