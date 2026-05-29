import { ApiProperty } from "@nestjs/swagger";
import { IsInt, Max, Min } from "class-validator";

export class PlaylistTracksQuery {
	@IsInt()
	@Min(0)
	@Max(1_000)
	@ApiProperty({
		type: "integer",
		minimum: 0,
		maximum: 1_000,
	})
	amount: number;

	@IsInt()
	@Min(0)
	@ApiProperty({
		type: "integer",
		minimum: 0,
	})
	offset: number;
}
