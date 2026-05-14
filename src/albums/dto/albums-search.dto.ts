import { ApiProperty } from "@nestjs/swagger";
import { IsInt, Min, Max } from "class-validator";

export class AlbumsSearchDto {
	@IsInt()
	@Min(1)
	@Max(30)
	@ApiProperty({
		type: "integer",
		minimum: 1,
		maximum: 30,
	})
	pageSize: number;

	@IsInt()
	@Min(1)
	@ApiProperty({
		type: "integer",
		minimum: 1,
	})
	page: number;
}
