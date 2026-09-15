import { ApiProperty, ApiSchema } from "@nestjs/swagger";
import { IdentifierDependencyResponse } from "./identifier.dependency";
import { IdentifierTarget } from "../enum/identifier-target.enum";
import { IdentifierType } from "../enum/identifier-type.enum";

@ApiSchema({ name: "Identifier" })
export class IdentifierResponse {
	@ApiProperty()
	pluginId: string;

	@ApiProperty()
	identifierId: string;

	@ApiProperty({ enum: IdentifierType, enumName: "IdentifierType" })
	type: IdentifierType;

	@ApiProperty({
		enum: IdentifierTarget,
		enumName: "IdentifierTarget",
		nullable: true,
	})
	target: IdentifierTarget | null;

	@ApiProperty({
		type: [IdentifierDependencyResponse],
	})
	dependencies: IdentifierDependencyResponse[];

	@ApiProperty({
		type: [IdentifierDependencyResponse],
	})
	softDependencies: IdentifierDependencyResponse[];

	@ApiProperty()
	disabled: boolean;
}
