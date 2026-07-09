import { ApiProperty } from "@nestjs/swagger";
import { IsNotEmpty, IsString, ValidateIf } from "class-validator";

export class AddWorkflowStepDto {
	@ApiProperty({
		type: "string",
		nullable: true,
	})
	@ValidateIf((_, value) => value !== null)
	@IsString()
	@IsNotEmpty()
	pluginId: string | null;

	@ApiProperty()
	@IsString()
	@IsNotEmpty()
	stepId: string;
}
