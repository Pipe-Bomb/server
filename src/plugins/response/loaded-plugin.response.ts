import { ApiProperty, ApiSchema } from "@nestjs/swagger";

@ApiSchema({ name: "LoadedPlugin" })
export class LoadedPluginResponse {
	@ApiProperty()
	name: string;

	@ApiProperty()
	version: string;

	@ApiProperty({
		type: String,
		nullable: true,
	})
	description: string | null;
}
