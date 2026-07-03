import { IsEnum } from "class-validator";
import { PlaylistVisibility } from "../enum/playlist-visibility.enum";

export class PlaylistVisibilityDto {
	@IsEnum(PlaylistVisibility)
	visibility: PlaylistVisibility;
}
