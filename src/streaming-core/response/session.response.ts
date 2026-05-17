import { ApiProperty, ApiSchema } from "@nestjs/swagger";
import { StreamInstanceType } from "../enum/session-type.enum";
import { RelativeUrl } from "src/interception/relative-url";

@ApiSchema({ name: "StreamInstance" })
export class StreamInstanceResponse {
	@ApiProperty()
	id: string;

	@ApiProperty({
		type: "string",
	})
	baseUrl: RelativeUrl;

	@ApiProperty({
		enum: StreamInstanceType,
	})
	type: StreamInstanceType;
}
