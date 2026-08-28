import { Type } from "class-transformer";
import {
	IsArray,
	IsNotEmpty,
	IsOptional,
	IsString,
	IsUrl,
	ValidateNested,
} from "class-validator";

export class MarketplaceManifestPluginDto {
	@IsString()
	@IsNotEmpty()
	id: string;

	@IsString()
	@IsNotEmpty()
	name: string;

	@IsString()
	@IsOptional()
	description?: string;

	@IsString()
	@IsNotEmpty()
	authorName: string;

	@IsUrl()
	@IsOptional()
	authorUrl?: string;

	@IsUrl()
	@IsOptional()
	url?: string;

	@IsString()
	@IsNotEmpty()
	repository: string;
}

export class MarketplaceManifestDto {
	@IsString()
	@IsNotEmpty()
	name: string;

	@IsArray()
	@ValidateNested({ each: true })
	@Type(() => MarketplaceManifestPluginDto)
	plugins: MarketplaceManifestPluginDto[];
}
