import { ApiProperty, ApiSchema } from "@nestjs/swagger";

@ApiSchema({ name: "CreationSession" })
export class CreationSessionResponse {
	@ApiProperty()
	uuid: string;

	@ApiProperty({
		type: Date,
	})
	dateStarted: Date;

	@ApiProperty({
		minimum: 0,
		maximum: 100,
		nullable: true,
		type: "number",
	})
	percent: number | null;
}
