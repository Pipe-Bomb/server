import { ApiProperty, ApiSchema } from "@nestjs/swagger";

@ApiSchema({ name: "UserConfigStub" })
export class UserConfigStubResponse {
	@ApiProperty()
	pluginId: string;

	@ApiProperty()
	configId: string;
}
