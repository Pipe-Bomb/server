import { ApiProperty, ApiSchema } from "@nestjs/swagger";

@ApiSchema({ name: "PluginConfigStub" })
export class PluginConfigStubResponse {
	@ApiProperty()
	id: string;
}
