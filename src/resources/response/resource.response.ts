import { ApiProperty, ApiSchema } from "@nestjs/swagger";
import { RelativeUrl } from "src/interception/relative-url";

@ApiSchema({ name: "Resource" })
export class ResourceResponse {
	@ApiProperty()
	uuid: string;

	@ApiProperty({
		type: "string",
	})
	url: RelativeUrl;

	@ApiProperty()
	extension: string;

	@ApiProperty()
	sha256: string;
}
