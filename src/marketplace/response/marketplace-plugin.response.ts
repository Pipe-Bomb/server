import { ApiProperty, ApiSchema } from "@nestjs/swagger";

@ApiSchema({ name: "MarketplacePlugin" })
export class MarketplacePluginResponse {
	@ApiProperty()
	id: string;

	@ApiProperty()
	name: string;

	@ApiProperty({ type: String, nullable: true })
	description: string | null;

	@ApiProperty()
	authorName: string;

	@ApiProperty({ type: String, nullable: true })
	authorUrl: string | null;

	@ApiProperty({ type: String, nullable: true })
	url: string | null;

	@ApiProperty()
	repository: string;

	@ApiProperty()
	marketplaceUuid: string;

	@ApiProperty()
	marketplaceName: string;

	@ApiProperty()
	installed: boolean;
}
