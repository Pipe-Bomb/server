import { ApiProperty } from "@nestjs/swagger";
import { IsNotEmpty, IsString } from "class-validator";
import { EphemeralSourceDto } from "./ephemeral-source.dto";

export class EphemeralSearchDto extends EphemeralSourceDto {
	@IsString()
	@IsNotEmpty()
	@ApiProperty()
	query: string;
}
