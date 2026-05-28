import { Type } from "class-transformer";
import { IsArray, ValidateIf, ValidateNested } from "class-validator";
import { NewPlaylistTrackDto } from "./new-playlist-track.dto";
import { ApiProperty } from "@nestjs/swagger";
import { NewPlaylistAlbumDto } from "./new-playlist-album.dto";

export class AddPlaylistTracksDto {
	@ValidateIf((_, value) => value !== null)
	@IsArray()
	@Type(() => NewPlaylistTrackDto)
	@ValidateNested({ each: true })
	@ApiProperty({
		type: [NewPlaylistTrackDto],
		nullable: true,
	})
	tracks: NewPlaylistTrackDto[] | null;

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
