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
			withTrackCount?: number;
		} = {},
	) {
		const playlist = await this.playlistsRepository.findOne({
			where: {
				uuid,
			},
			relations: {
				attributes: options.withAttributes,
				owner: options.withOwner,
			},
		});

		if (!playlist) {
			return null;
		}

		if (options.withTracks) {
			const [topTracks, trackCount] =
				await this.playlistTracksRepository.findAndCount({
					where: {
						playlistUuid: playlist.uuid,
					},
					relations: {
						track: {
							artists: !!options.withTrackArtists && {
								artist: {
									attributes: true,
								},
							},
							attributes: options.withTrackAttributes,
						},
					},
					order: {
						dateAdded: "asc",
						ordinal: "asc",
					},
					take: 50,
				});

			playlist.tracks = topTracks;

			return {
				playlist,
				trackCount,
			};
		}

		return {
			playlist,
			trackCount: null,
		};
	}

	findAllTracks(playlist: DBPlaylist) {
		return this.playlistTracksRepository.find({
			where: {
				playlistUuid: playlist.uuid,
			},
			relations: {
				track: true,
			},
			order: {
				dateAdded: "asc",
				ordinal: "asc",
			},
		});
	}

	findTracks(
		playlist: DBPlaylist,
		options: {
			offset: number;
			amount: number;
			withTrackAttributes?: boolean;
			withTrackArtists?: boolean;
		},
	) {
		return this.playlistTracksRepository.find({
			where: {
				playlistUuid: playlist.uuid,
			},
			relations: {
				track: {
					artists: !!options.withTrackArtists && {
						artist: {
							attributes: true,
						},
					},
					attributes: options.withTrackAttributes,
				},
			},
			order: {
				dateAdded: "asc",
				ordinal: "asc",
			},
			take: options.amount,
			skip: options.offset,
		});
	}

	async addTracks(
		playlist: DBPlaylist,
		tracks: DBTrack[],
		user: DBUser | null,
	) {
		await this.playlistTracksRepository.upsert(
			tracks.map((track, ordinal) => ({
				trackUuid: track.uuid,
				playlistUuid: playlist.uuid,
				addedByUuid: user?.uuid ?? null,
				ordinal,
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
