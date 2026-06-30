import { Type } from "class-transformer";
import { IsArray, ValidateIf, ValidateNested } from "class-validator";
import { AddPlaylistTracksDto } from "./add-playlist-tracks.dto";
import { ApiProperty } from "@nestjs/swagger";
import { TrackIdDto } from "src/tracks/dto/track-id.dto";

export class UpdatePlaylistTracksDto {
	@ValidateIf((_, value) => value !== null)
	@Type(() => AddPlaylistTracksDto)
	@ValidateNested()
	@ApiProperty({
		type: AddPlaylistTracksDto,
		nullable: true,
	})
	add: AddPlaylistTracksDto | null;

	@ValidateIf((_, value) => value !== null)
	@IsArray()
	@Type(() => TrackIdDto)
	@ValidateNested({ each: true })
	@ApiProperty({
		type: [TrackIdDto],
		nullable: true,
	})
	remove: TrackIdDto[] | null;
}
