import { ApiProperty } from "@nestjs/swagger";
import { IsNotEmpty, IsString } from "class-validator";

export class LoginDto {
	@IsString()
	@IsNotEmpty()
	@ApiProperty()
	username: string;

	@IsString()
	@IsNotEmpty()
	@ApiProperty()
	password: string;
}
