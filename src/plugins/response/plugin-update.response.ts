import { ApiProperty, ApiSchema } from "@nestjs/swagger";

@ApiSchema({ name: "PluginUpdate" })
export class PluginUpdateResponse {
	@ApiProperty()
	updatesAvailable: boolean;

	@ApiProperty()
	commitsBehind: number;
}
