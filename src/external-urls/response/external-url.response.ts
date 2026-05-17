import { ApiProperty, ApiSchema } from "@nestjs/swagger";
import { RelativeUrl } from "src/interception/relative-url";

@ApiSchema({ name: "ExternalUrl" })
export class ExternalUrlResponse {
	@ApiProperty()
	url: string;

	@ApiProperty({
		type: "string",
	})
	iconUrl: RelativeUrl;

	@ApiProperty()
	name: string;
}
