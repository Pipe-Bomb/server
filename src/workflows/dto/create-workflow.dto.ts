import { ApiProperty } from "@nestjs/swagger";
import { IsNotEmpty, IsString, MaxLength } from "class-validator";

export class CreateWorkflowDto {
	@ApiProperty({
		maxLength: 255,
		minLength: 1,
	})
	@IsString()
	@IsNotEmpty()
	@MaxLength(255)
	name: string;
}
