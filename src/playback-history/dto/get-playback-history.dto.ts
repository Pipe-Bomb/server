import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import { IsInt, IsOptional, IsString, Max, Min } from "class-validator";

export class GetPlaybackHistoryDto {
	@Type(() => Number)
	@IsInt()
	@Min(1)
	@Max(100)
	@ApiProperty({
		type: "integer",
		minimum: 1,
		maximum: 100,
	})
	pageSize: number;

	@Type(() => Number)
	@IsInt()
	@Min(1)
	@ApiProperty({
		type: "integer",
		minimum: 1,
	})
	page: number;

	@IsOptional()
	@IsString()
	@ApiPropertyOptional({ type: String })
	pluginId?: string;

	@IsOptional()
	@IsString()
	@ApiPropertyOptional({ type: String })
	clientName?: string;
}
