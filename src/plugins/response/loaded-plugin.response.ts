import { ApiProperty, ApiSchema } from "@nestjs/swagger";
import { PluginUpdateStatus } from "../enum/plugin-update-status.enum";

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

	@ApiProperty({ enum: PluginUpdateStatus })
	updateStatus: PluginUpdateStatus;
}
