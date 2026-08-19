import { ApiProperty, ApiSchema } from "@nestjs/swagger";

@ApiSchema({
	name: "PipeBombError",
})
export class ErrorResponse {
	@ApiProperty()
	error: string;

	@ApiProperty()
	message: string;

	@ApiProperty({
		type: "integer",
	})
	statusCode: number;
}
