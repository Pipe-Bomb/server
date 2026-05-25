import { ApiProperty, ApiSchema } from "@nestjs/swagger";
import { LoadedAttributeResponse } from "./loaded-attribute.response";

@ApiSchema({ name: "AllAttributes" })
export class AllAttributesResponse {
	@ApiProperty({
		type: [LoadedAttributeResponse],
	})
	track: LoadedAttributeResponse[];

	@ApiProperty({
		type: [LoadedAttributeResponse],
	})
	artist: LoadedAttributeResponse[];

	@ApiProperty({
		type: [LoadedAttributeResponse],
	})
	album: LoadedAttributeResponse[];
}
