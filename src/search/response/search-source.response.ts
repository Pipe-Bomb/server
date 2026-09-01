import { ApiProperty, ApiPropertyOptional, ApiSchema } from "@nestjs/swagger";

@ApiSchema({ name: "SortMethod" })
export class SortMethodResponse {
	@ApiProperty()
	key: string;

	@ApiPropertyOptional({ nullable: true, type: String })
	label: string | null;

	@ApiProperty()
	ascending: boolean;

	@ApiProperty()
	descending: boolean;
}

@ApiSchema({ name: "FilterableAttribute" })
export class FilterableAttributeResponse {
	@ApiProperty({ enum: ["track", "artist", "album"] })
	entityType: "track" | "artist" | "album";

	@ApiProperty()
	attributeKey: string;

	@ApiProperty()
	attributeType: string;

	@ApiPropertyOptional({ nullable: true, type: String })
	label: string | null;

	@ApiPropertyOptional({ nullable: true, type: Boolean })
	supportsFuzzy: boolean | null;
}

@ApiSchema({ name: "SearchSourceSummary" })
export class SearchSourceSummaryResponse {
	@ApiProperty()
	pluginId: string;

	@ApiProperty()
	sourceId: string;

	@ApiProperty()
	name: string;

	@ApiProperty()
	active: boolean;
}

@ApiSchema({ name: "SearchSource" })
export class SearchSourceResponse {
	@ApiProperty()
	pluginId: string;

	@ApiProperty()
	sourceId: string;

	@ApiProperty()
	name: string;

	@ApiPropertyOptional({ nullable: true, type: [SortMethodResponse] })
	sortMethods: SortMethodResponse[] | null;

	@ApiPropertyOptional({ nullable: true, type: [FilterableAttributeResponse] })
	filterableAttributes: FilterableAttributeResponse[] | null;
}
