import { IsString, IsUUID, ValidateIf } from "class-validator";

export class NewPlaylistAlbumDto {
	@ValidateIf((_, value) => value !== null)
	@IsUUID()
	uuid: string | null;

	@ValidateIf((_, value) => value !== null)
	@IsString()
	pluginId: string | null;

	@ValidateIf((_, value) => value !== null)
	@IsString()
	identityId: string | null;

	@ValidateIf((_, value) => value !== null)
	@IsString()
	identity: string | null;
}
