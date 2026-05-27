import { BadRequestException, Injectable, Logger } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { DBPlaylist } from "./entity/playlist.entity";
import { Repository } from "typeorm";
import { DBPlaylistTrack } from "./entity/playlist-track.entity";
import { DBUser } from "src/users/entity/user.entity";
import {
	ContainedCustomAttributeDto,
	CustomAttributeDto,
} from "src/attributes/dto/custom-attribute.dto";
import { DBPlaylistAttribute } from "src/attributes/entities/playlist-attribute.entity";
import { AttributeSourcesService } from "src/attribute-sources/attribute-sources.service";
import { DBTrack } from "src/tracks/entities/track.entity";

@Injectable()
export class PlaylistsService {
	private readonly logger = new Logger("Playlists Service");

	constructor(
		@InjectRepository(DBPlaylist)
		private readonly playlistsRepository: Repository<DBPlaylist>,
		@InjectRepository(DBPlaylistTrack)
		private readonly playlistTracksRepository: Repository<DBPlaylistTrack>,
		private readonly attributeSourcesService: AttributeSourcesService,
	) {
		this.attributeSourcesService.registerPlaylistAttribute(null, {
			key: "title",
			type: "string",
			supportsMultiple: false,
		});
		this.attributeSourcesService.registerPlaylistAttribute(null, {
			key: "thumb",
			type: "buffer",
			supportsMultiple: false,
		});
	}

	async create(owner: DBUser, attributes: ContainedCustomAttributeDto[]) {
		const playlist = this.playlistsRepository.create({
			owner,
		});
		await this.playlistsRepository.insert(playlist);

		let dbAttributes: DBPlaylistAttribute[] = [];
		try {
			const newAttributes =
				await this.attributeSourcesService.createPlaylistAttributes(
					playlist.uuid,
					this.attributeSourcesService.customToAttributeValues(attributes),
					null,
				);

			dbAttributes.push(...newAttributes);
		} catch (e) {
			this.logger.error(
				"Failed to create Attributes for Playlist during creation:",
				e,
			);
			throw new BadRequestException("Invalid Attributes");
		}

		playlist.attributes = dbAttributes;
		await this.attributeSourcesService.upsertPlaylistAttributes(dbAttributes);

		return playlist;
	}

	async findForUser(
		user: DBUser,
		options: {
			withAttributes?: boolean;
		} = {},
	) {
		return this.playlistsRepository.find({
			where: {
				ownerUuid: user.uuid,
			},
			relations: {
				attributes: options.withAttributes,
			},
		});
	}

	async findByUuid(
		uuid: string,
		options: {
			withAttributes?: boolean;
			withTracks?: boolean;
			withTrackAttributes?: boolean;
			withTrackArtists?: boolean;
			withOwner?: boolean;
		} = {},
	) {
		return this.playlistsRepository.findOne({
			where: {
				uuid,
			},
			relations: {
				attributes: options.withAttributes,
				tracks: !!options.withTracks && {
					track: {
						artists: !!options.withTrackArtists && {
							artist: {
								attributes: true,
							},
						},
						attributes: options.withTrackAttributes,
					},
				},
				owner: options.withOwner,
			},
			order:
				(!!options.withTracks && {
					tracks: {
						dateAdded: "asc",
					},
				}) ||
				undefined,
		});
	}

	async addTracks(
		playlist: DBPlaylist,
		tracks: DBTrack[],
		user: DBUser | null,
	) {
		await this.playlistTracksRepository.upsert(
			tracks.map((track) => ({
				trackUuid: track.uuid,
				playlistUuid: playlist.uuid,
				addedByUuid: user?.uuid ?? null,
			})),
			{
				conflictPaths: ["trackUuid", "playlistUuid"],
				skipUpdateIfNoValuesChanged: true,
			},
		);
	}

	async delete(playlist: DBPlaylist) {
		await this.playlistsRepository.remove(playlist);
	}
}
