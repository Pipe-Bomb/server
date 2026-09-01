import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsInt, IsOptional, Max, Min, ValidateNested } from "class-validator";
import { Type } from "class-transformer";
import { SearchSortDto } from "src/search/dto/search-sort.dto";

export class ArtistsSearchDto {
	@IsInt()
	@Min(1)
	@Max(30)
	@ApiProperty({
		type: "integer",
		minimum: 1,
		maximum: 30,
	})
	pageSize: number;

	@IsInt()
	@Min(1)
	@ApiProperty({
		type: "integer",
		minimum: 1,
	})
	page: number;

	@IsOptional()
	@ValidateNested()
	@Type(() => SearchSortDto)
	@ApiPropertyOptional({ type: SearchSortDto })
	sort?: SearchSortDto;
}
