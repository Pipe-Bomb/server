import { ApiProperty } from "@nestjs/swagger";
import { IsBoolean, IsString, ValidateIf } from "class-validator";

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

	@ValidateIf((_, value) => value !== null)
	@IsString()
	@ApiProperty({
		type: "string",
		nullable: true,
	})
	query: string | null;
}
