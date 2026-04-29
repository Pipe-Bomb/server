import { IsNotEmpty, IsOptional, IsSemVer, IsString } from "class-validator";
import Sdk from "@sdk";

export class PluginPackageDto implements Sdk.PluginPackage {
	@IsString()
	@IsNotEmpty()
	name: string;

	@IsSemVer()
	version: string;

	@IsString()
	@IsOptional()
	pipebombEntry: string | undefined;

	@IsString()
	@IsOptional()
	main: string | undefined;
}
