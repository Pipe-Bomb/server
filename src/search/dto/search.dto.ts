import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsBoolean, IsOptional, IsString } from "class-validator";

export class SearchDto {
	@IsBoolean()
	@ApiProperty({
		type: "boolean",
	})
	withTracks: boolean;

	@IsBoolean()
	@ApiProperty({
		type: "boolean",
	})
	withAlbums: boolean;

	@IsBoolean()
	@ApiProperty({
		type: "boolean",
	})
	withArtists: boolean;

	@IsOptional()
	@IsString()
	@ApiPropertyOptional({
		type: "string",
	})
	query?: string;
}
