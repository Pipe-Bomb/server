import { ApiProperty } from "@nestjs/swagger";
import { IsNotEmpty, IsString } from "class-validator";

export class TrackIdDto {
	@IsString()
	@IsNotEmpty()
	@ApiProperty()
	pluginId: string;

	@IsString()
	@IsNotEmpty()
	@ApiProperty()
	libraryId: string;

	@IsString()
	@IsNotEmpty()
	@ApiProperty()
	trackId: string;
}
