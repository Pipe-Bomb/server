import { ApiProperty, ApiSchema } from "@nestjs/swagger";

@ApiSchema({ name: "TrackCreationSession" })
export class TrackCreationSessionResponse {
	@ApiProperty()
	uuid: string;

	@ApiProperty({
		type: Date,
	})
	dateStarted: Date;

	@ApiProperty({
		type: Number,
	})
	percent: number;
}
