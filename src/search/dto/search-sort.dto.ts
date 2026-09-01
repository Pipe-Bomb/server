import { ApiProperty } from "@nestjs/swagger";
import { IsIn, IsNotEmpty, IsString } from "class-validator";

export class SearchSortDto {
	@ApiProperty()
	@IsString()
	@IsNotEmpty()
	key: string;

	@ApiProperty({ enum: ["asc", "desc"] })
	@IsIn(["asc", "desc"])
	direction: "asc" | "desc";
}
