import { Type } from "class-transformer";
import { IsArray, ValidateNested } from "class-validator";
import { NewPlaylistTrackDto } from "./new-playlist-track.dto";
import { ApiProperty } from "@nestjs/swagger";

export class AddPlaylistTracksDto {
	@IsArray()
	@Type(() => NewPlaylistTrackDto)
	@ValidateNested({ each: true })
	@ApiProperty({
		type: [NewPlaylistTrackDto],
	})
	tracks: NewPlaylistTrackDto[];
}
