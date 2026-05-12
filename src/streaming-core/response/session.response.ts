import { ApiProperty, ApiSchema } from "@nestjs/swagger";
import { StreamInstanceType } from "../enum/session-type.enum";

@ApiSchema({ name: "StreamInstance" })
export class StreamInstanceResponse {
	@ApiProperty()
	id: string;

	@ApiProperty({
		enum: StreamInstanceType,
	})
	type: StreamInstanceType;
}
