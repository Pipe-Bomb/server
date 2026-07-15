import { BadRequestException, Injectable, Logger } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { DBPlaylist } from "./entity/playlist.entity";
import { In, Repository } from "typeorm";
import { DBPlaylistTrack } from "./entity/playlist-track.entity";
import { DBUser } from "src/users/entity/user.entity";
import { DBPlaylistAttribute } from "src/attributes/entities/playlist-attribute.entity";
import { AttributeSourcesService } from "src/attribute-sources/attribute-sources.service";
import { DBTrack } from "src/tracks/entities/track.entity";
import { AttributeType, AttributeValue, PlaylistClient } from "@sdk";
import { UsersService } from "src/users/users.service";
import { AttributeUploadService } from "src/attributes/attribute-upload.service";
import { PlaylistVisibility } from "./enum/playlist-visibility.enum";
import { LoadedPlugin } from "src/plugins/interface/loaded-plugin.interface";
import { LoadedAttributeSource } from "src/attributes/interface/loaded-attribute-source.interface";

@Injectable()
export class PlaylistsService {
	private readonly logger = new Logger("Playlists Service");

	constructor(
		@InjectRepository(DBPlaylist)
		private readonly playlistsRepository: Repository<DBPlaylist>,
		@InjectRepository(DBPlaylistTrack)
		private readonly playlistTracksRepository: Repository<DBPlaylistTrack>,
		private readonly attributeSourcesService: AttributeSourcesService,
		private readonly usersService: UsersService,
		private readonly attributeUploadService: AttributeUploadService,
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

	async create(owner: DBUser, attributes: AttributeValue[]) {
		const playlist = this.playlistsRepository.create({
			owner,
		});
		await this.playlistsRepository.insert(playlist);

		let dbAttributes: DBPlaylistAttribute[] = [];
		try {
			const newAttributes =
				await this.attributeSourcesService.createPlaylistAttributes(
					playlist.uuid,
					attributes,
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
		await this.attributeSourcesService.upsertPlaylistAttributes(
			playlist.uuid,
			dbAttributes,
		);

		return playlist;
	}

	async updateAttributes(
		playlist: DBPlaylist,
		attributes: AttributeValue[],
		attributeSource: LoadedAttributeSource | null,
		user?: DBUser,
	) {
		const bufferAttributes: AttributeValue<"buffer">[] = [];
		const supportedAttributes: AttributeValue[] = [];

		const playlistAttributes =
			this.attributeSourcesService.getPlaylistAttributes();

		for (const attribute of attributes) {
			const loadedAttribute = playlistAttributes.find(
				(attr) => attr.attribute.key == attribute.key,
			);
			if (
				loadedAttribute?.attribute.type == "buffer" &&
				typeof attribute.value == "object" &&
				!attribute.value.buffer
			) {
				bufferAttributes.push(attribute as AttributeValue<"buffer">);
			} else {
				supportedAttributes.push(attribute);
			}
		}

		let dbAttributes: DBPlaylistAttribute[] = [];
		try {
			const newAttributes =
				await this.attributeSourcesService.createPlaylistAttributes(
					playlist.uuid,
					supportedAttributes,
					attributeSource,
				);

			dbAttributes.push(...newAttributes);
		} catch (e) {
			this.logger.error(
				"Failed to create Attributes for Playlist during creation:",
				e,
			);
			throw new BadRequestException("Invalid Attributes");
		}

		const keys = attributes.map(({ key }) => key);

		if (playlist.attributes) {
			playlist.attributes = playlist.attributes.filter(
				(attribute) => !keys.includes(attribute.key),
			);
		}

		await this.attributeSourcesService.upsertPlaylistAttributes(
			playlist.uuid,
			dbAttributes,
		);

		if (bufferAttributes.length) {
			if (!user) {
				throw new Error("Buffer attributes cannot be handled without a User");
			}

			const sessions = bufferAttributes.map((attribute) => {
				let resolve: (buffer: Buffer) => void;
				let reject: (error: Error) => void;

				const session = this.attributeUploadService.createSession(
					user,
					attribute.key,
					attribute.value.extension,
					(buffer) => resolve(buffer),
					(error) => reject(error),
				);

				const promise = new Promise<Buffer>((res, rej) => {
					resolve = res;
					reject = rej;
				});

				return {
					session,
					promise,
					attribute,
				};
			});

			Promise.allSettled(sessions.map(({ promise }) => promise)).then(
				(responses) => {
					const toSave: AttributeValue<"buffer">[] = [];

					for (const [i, response] of responses.entries()) {
						if (response.status != "fulfilled") {
							continue;
						}

						const buffer = response.value;
						const session = sessions[i];
						if (session) {
							session.attribute.value.buffer = buffer;
							toSave.push(session.attribute);
						}
					}

					if (toSave.length) {
						this.updateAttributes(
							playlist,
							attributes,
							attributeSource,
							user,
						).catch((e) =>
							this.logger.error(
								`Failed to save delayed buffer Attributes to Playlist:`,
								e,
							),
						);
					}
				},
			);

			return sessions.map(({ session }) => session);
		}

		return [];
	}

	private async updateDateModified(playlist: DBPlaylist | string) {
		const now = Date.now();
		if (typeof playlist == "object") {
			playlist.dateModified = now;
		}

		await this.playlistsRepository.update(
			{
				uuid: typeof playlist == "string" ? playlist : playlist.uuid,
			},
			{
				dateModified: now,
			},
		);
	}

	async setVisibility(uuid: string, visibility: PlaylistVisibility) {
		await this.playlistsRepository.update(
			{
				uuid,
			},
			{
				visibility,
			},
		);
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
			withTracks?: number;
			withTrackAttributes?: boolean;
			withTrackArtists?: boolean;
			withTrackUsers?: boolean;
			withTrackAlbums?: boolean;
			withOwner?: boolean;
			withTrackCount?: number;
			withSmartFilters?: boolean;
		} = {},
	) {
		const playlist = await this.playlistsRepository.findOne({
			where: {
				uuid,
			},
			relations: {
				attributes: options.withAttributes,
				owner: options.withOwner,
				filterGroups: !!options.withSmartFilters && {
					filters: true,
				},
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
							albums: options.withTrackAlbums && {
								album: {
									attributes: true,
								},
							},
						},
						addedBy: options.withTrackUsers,
					},
					order: {
						dateAdded: "asc",
						ordinal: "asc",
					},
					take: options.withTracks,
					relationLoadStrategy: "query",
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
			withTrackUsers?: boolean;
			withTrackAlbums?: boolean;
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
					albums: !!options.withTrackAlbums && {
						album: {
							attributes: true,
						},
					},
				},
				addedBy: options.withTrackUsers,
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
		playlist: DBPlaylist | string,
		tracks: DBTrack[] | string[],
		user: DBUser | null,
	) {
		await this.playlistTracksRepository.upsert(
			tracks.map((track, ordinal) => ({
				trackUuid: typeof track == "string" ? track : track.uuid,
				playlistUuid: typeof playlist == "string" ? playlist : playlist.uuid,
				addedByUuid: user?.uuid ?? null,
				ordinal,
			})),
			{
				conflictPaths: ["trackUuid", "playlistUuid"],
				skipUpdateIfNoValuesChanged: true,
			},
		);

		await this.updateDateModified(playlist);
	}

	async removeTracks(
		playlist: DBPlaylist | string,
		tracks: DBTrack[] | string[],
	) {
		await this.playlistTracksRepository.delete({
			playlistUuid: typeof playlist == "string" ? playlist : playlist.uuid,
			trackUuid: In(
				tracks.map((track) => (typeof track == "string" ? track : track.uuid)),
			),
		});
		await this.updateDateModified(playlist);
	}

	async delete(playlist: DBPlaylist) {
		await this.playlistsRepository.remove(playlist);
	}

	createPlaylistClient(plugin: LoadedPlugin): PlaylistClient {
		return {
			getUserPlaylistUuids: async (uuid) => {
				const playlists = await this.playlistsRepository.find({
					where: {
						ownerUuid: uuid,
					},
					select: ["uuid"],
				});
				return playlists.map(({ uuid }) => uuid);
			},
			getPlaylist: async (uuid, { relations } = {}) => {
				const playlist = await this.playlistsRepository.findOne({
					where: {
						uuid,
					},
					relations: {
						attributes: relations?.attributes,
						filterGroups: relations?.filterGroups && {
							filters: true,
						},
						owner: relations?.owner,
						tracks:
							typeof relations?.tracks == "object"
								? {
										addedBy: relations.tracks.addedBy,
										track:
											typeof relations.tracks.track == "object"
												? {
														identities: relations.tracks.track.identities,
														attributes: relations.tracks.track.attributes,
														artists: relations.tracks.track.artists && {
															artist:
																typeof relations.tracks.track.artists ==
																"object"
																	? {
																			identities:
																				relations.tracks.track.artists
																					.identities,
																			attributes:
																				relations.tracks.track.artists
																					.attributes,
																		}
																	: true,
														},
													}
												: relations.tracks.track,
									}
								: relations?.tracks,
					},
					order: {
						tracks:
							(relations?.tracks && {
								dateAdded: "asc",
								ordinal: "asc",
							}) ||
							undefined,
					},
				});
				return playlist?.toSavedResponse() ?? null;
			},
			addToPlaylist: async (uuid, trackUuids, options = {}) => {
				const playlist = await this.findByUuid(uuid);

				if (!playlist) {
					throw new Error("Playlist doesn't exist");
				}

				let user: DBUser | null = null;
				if (options.asUser) {
					user = await this.usersService.findOne(options.asUser);

					if (!user) {
						throw new Error("User doesn't exist");
					}

					if (user.uuid != playlist.playlist.ownerUuid) {
						throw new Error("User cannot modify playlist");
					}
				}

				await this.addTracks(playlist.playlist, trackUuids, user);
			},
			removeFromPlaylist: async (uuid, trackUuids, options = {}) => {
				const playlist = await this.findByUuid(uuid);

				if (!playlist) {
					throw new Error("Playlist doesn't exist");
				}

				let user: DBUser | null = null;
				if (options.asUser) {
					user = await this.usersService.findOne(options.asUser);

					if (!user) {
						throw new Error("User doesn't exist");
					}

					if (user.uuid != playlist.playlist.ownerUuid) {
						throw new Error("User cannot modify playlist");
					}
				}

				await this.removeTracks(playlist.playlist, trackUuids);
			},
			createUserPlaylist: async (ownerUuid, { attributes } = {}) => {
				const user = await this.usersService.findOne(ownerUuid);
				if (!user) {
					throw new Error("User doesn't exist");
				}

				const playlist = await this.create(user, attributes ?? []);
				return playlist.uuid;
			},
			deletePlaylist: async (uuid, options = {}) => {
				const playlist = await this.findByUuid(uuid);

				if (!playlist) {
					throw new Error("Playlist doesn't exist");
				}

				let user: DBUser | null = null;
				if (options.asUser) {
					user = await this.usersService.findOne(options.asUser);

					if (!user) {
						throw new Error("User doesn't exist");
					}

					if (user.uuid != playlist.playlist.ownerUuid) {
						throw new Error("User cannot delete playlist");
					}
				}

				await this.delete(playlist.playlist);
			},
			updatePlaylistAttributes: async (
				uuid,
				attributeSourceId,
				attributes,
				options = {},
			) => {
				const playlist = await this.findByUuid(uuid);

				if (!playlist) {
					throw new Error("Playlist doesn't exist");
				}

				const attributeSource = this.attributeSourcesService.getAttributeSource(
					plugin.package.name,
					attributeSourceId,
				);
				if (!attributeSource) {
					throw new Error("Attribute source not registered");
				}

				let user: DBUser | null = null;
				if (options.asUser) {
					user = await this.usersService.findOne(options.asUser);

					if (!user) {
						throw new Error("User doesn't exist");
					}

					if (user.uuid != playlist.playlist.ownerUuid) {
						throw new Error("User cannot update playlist attributes");
					}
				}

				this.updateAttributes(playlist.playlist, attributes, attributeSource);
			},
		};
	}
}
