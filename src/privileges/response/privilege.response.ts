import { ApiProperty, ApiSchema } from "@nestjs/swagger";

@ApiSchema({ name: "Privilege" })
export class PrivilegeResponse {
	@ApiProperty({
		nullable: true,
		type: String,
	})
	pluginId: string | null;

	@ApiProperty()
	key: string;

	@ApiProperty()
	granted: boolean;

	@ApiProperty({
		type: [String],
	})
	includedIn: string[];

	@ApiProperty()
	grantedByInclusion: boolean;
}
