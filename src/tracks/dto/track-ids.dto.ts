import { Type } from "class-transformer";
import { ArrayMaxSize, IsArray, ValidateNested } from "class-validator";
import { TrackIdDto } from "./track-id.dto";
import { ApiProperty } from "@nestjs/swagger";

export class TrackIdsDto {
	@ValidateNested({ each: true })
	@Type(() => TrackIdDto)
	@IsArray()
	@ArrayMaxSize(50)
	@ApiProperty({
		type: [TrackIdDto],
	})
	tracks: TrackIdDto[];
}
