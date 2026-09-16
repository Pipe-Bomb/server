import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import { IsDate, IsNotEmpty, IsOptional, IsString } from "class-validator";

export class ReportPlaybackDto {
	@IsString()
	@IsNotEmpty()
	@ApiProperty({ type: String })
	pluginId: string;

	@IsString()
	@IsNotEmpty()
	@ApiProperty({ type: String })
	libraryId: string;

	@IsString()
	@IsNotEmpty()
	@ApiProperty({ type: String })
	trackId: string;

	@IsString()
	@IsNotEmpty()
	@ApiProperty({ type: String })
	clientName: string;

	@IsOptional()
	@Type(() => Date)
	@IsDate()
	@ApiPropertyOptional({ type: Date })
	datePlayed?: Date;
}
