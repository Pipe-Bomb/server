import { ApiProperty, ApiSchema } from "@nestjs/swagger";

@ApiSchema({ name: "User" })
export class UserResponse {
	@ApiProperty()
	uuid: string;

	@ApiProperty()
	username: string;
}
