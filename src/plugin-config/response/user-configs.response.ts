import { ApiProperty, ApiSchema } from "@nestjs/swagger";
import { UserConfigStubResponse } from "./user-config-stub.response";

@ApiSchema({ name: "UserConfigs" })
export class UserConfigsResponse {
	@ApiProperty({
		type: [UserConfigStubResponse],
	})
	configs: UserConfigStubResponse[];
}
