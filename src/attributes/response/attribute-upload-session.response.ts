import { ApiProperty } from "@nestjs/swagger";
import { RelativeUrl } from "src/interception/relative-url";

export class AttributeUploadSessionResponse {
	@ApiProperty()
	uuid: string;

	@ApiProperty({
		type: "string",
	})
	url: RelativeUrl;
}
