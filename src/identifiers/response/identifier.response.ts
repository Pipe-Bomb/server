import { ApiProperty, ApiSchema } from "@nestjs/swagger";
import { IdentifierDependencyResponse } from "./identifier.dependency";

@ApiSchema({ name: "Identifier" })
export class IdentifierResponse {
	@ApiProperty()
	pluginId: string;

	@ApiProperty()
	identifierId: string;

	@ApiProperty({
		type: [IdentifierDependencyResponse],
	})
	dependencies: IdentifierDependencyResponse[];

	@ApiProperty({
		type: [IdentifierDependencyResponse],
	})
	softDependencies: IdentifierDependencyResponse[];
}
