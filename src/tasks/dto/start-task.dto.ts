import { ApiProperty } from "@nestjs/swagger";
import { IsNotEmpty, IsString, ValidateIf } from "class-validator";

export class StartTaskDto {
	@ValidateIf((_, value) => value !== null)
	@IsString()
	@IsNotEmpty()
	@ApiProperty({
		type: String,
		nullable: true,
	})
	subTask: string | null;
}
