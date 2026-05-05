import { ApiProperty, ApiSchema } from "@nestjs/swagger";

@ApiSchema({ name: "ExternalUrl" })
export class ExternalUrlResponse {
	@ApiProperty()
	url: string;

	@ApiProperty()
	iconUrl: string;

	@ApiProperty()
	name: string;
}
