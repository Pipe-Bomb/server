import { ApiProperty } from "@nestjs/swagger";

export class PluginLibrary {
	@ApiProperty()
	pluginId: string;

	@ApiProperty()
	id: string;

	@ApiProperty()
	name: string;
}
