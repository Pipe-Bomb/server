import { ApiProperty, ApiSchema } from "@nestjs/swagger";

@ApiSchema({ name: "IdentifierDependency" })
export class IdentifierDependencyResponse {
	@ApiProperty({
		type: String,
		nullable: true,
	})
	pluginId: string | null;

	@ApiProperty()
	sourceId: string;
}
