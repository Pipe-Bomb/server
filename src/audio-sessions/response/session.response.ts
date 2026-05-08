import { ApiProperty, ApiSchema } from "@nestjs/swagger";
import { SessionType } from "../enum/session-type.enum";
import type { AudioProducerType } from "@sdk";

@ApiSchema({ name: "Session" })
export class SessionResponse {
	@ApiProperty()
	id: string;

	@ApiProperty({
		enum: SessionType,
	})
	type: AudioProducerType;
}
