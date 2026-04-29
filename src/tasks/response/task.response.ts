import { ApiProperty, ApiSchema } from "@nestjs/swagger";

@ApiSchema({ name: "Task" })
export class TaskResponse {
	@ApiProperty()
	uuid: string;

	@ApiProperty({
		nullable: true,
		type: String,
	})
	pluginId: string | null;

	@ApiProperty()
	taskId: string;

	@ApiProperty()
	inProgress: boolean;

	@ApiProperty({
		minimum: 0,
		maximum: 100,
		nullable: true,
		type: "number",
	})
	percent: number | null;
}
