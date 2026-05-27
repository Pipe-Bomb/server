import { ApiProperty, ApiSchema } from "@nestjs/swagger";

@ApiSchema({ name: "TrackAddSessionId" })
export class TrackAddSessionIdResponse {
	@ApiProperty()
	sessionId: string;
}
