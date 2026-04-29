import { ApiProperty, ApiSchema } from "@nestjs/swagger";

@ApiSchema({ name: "Resource" })
export class ResourceResponse {
	@ApiProperty()
	uuid: string;

	@ApiProperty()
	url: string;

	@ApiProperty()
	extension: string;

	@ApiProperty()
	sha256: string;
}
