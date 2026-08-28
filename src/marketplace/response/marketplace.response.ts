import { ApiProperty, ApiSchema } from "@nestjs/swagger";

@ApiSchema({ name: "Marketplace" })
export class MarketplaceResponse {
	@ApiProperty()
	uuid: string;

	@ApiProperty()
	url: string;

	@ApiProperty({ type: String, nullable: true })
	name: string | null;

	@ApiProperty({ type: Number, nullable: true })
	pluginCount: number | null;

	@ApiProperty()
	reachable: boolean;

	@ApiProperty()
	addedAt: number;
}
