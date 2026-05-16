import { ApiProperty, ApiSchema } from "@nestjs/swagger";
import { PluginConfigStubResponse } from "./plugin-config-stub.response";

@ApiSchema({ name: "PluginConfigs" })
export class PluginConfigsResponse {
	@ApiProperty({
		type: [PluginConfigStubResponse],
	})
	configs: PluginConfigStubResponse[];
}
