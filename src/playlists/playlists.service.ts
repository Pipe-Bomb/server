import { BadRequestException, Injectable, Logger } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { DBPlaylist } from "./entity/playlist.entity";
import { DBPlaylistMember } from "./entity/playlist-member.entity";
import { FindOptionsWhere, In, IsNull, Repository } from "typeorm";
import { DBPlaylistTrack } from "./entity/playlist-track.entity";
import { DBUser } from "src/users/entity/user.entity";
import { DBPlaylistAttribute } from "src/attributes/entities/playlist-attribute.entity";
import { AttributeSourcesService } from "src/attribute-sources/attribute-sources.service";
import { DBTrack } from "src/tracks/entities/track.entity";
import {
	AttributeValue,
	PlaylistBotInfo,
	PlaylistPluginBot,
	ReadOnlyPlaylistClient,
	WritablePlaylistClient,
} from "@sdk";
import { UserManagerService } from "src/user-manager/user-manager.service";
import { AttributeUploadService } from "src/attributes/attribute-upload.service";
import { PlaylistVisibility } from "./enum/playlist-visibility.enum";
import { PlaylistMemberRole } from "./enum/playlist-member-role.enum";
import { LoadedPlugin } from "src/plugins/interface/loaded-plugin.interface";
import { LoadedAttributeSource } from "src/attributes/interface/loaded-attribute-source.interface";
import { EventEmitter2 } from "@nestjs/event-emitter";
import { emitServerEvent } from "src/util/emitter.util";
import { attributeSignature } from "src/attributes/attribute-signature.util";

@Injectable()
export class PlaylistsService {
	private readonly logger = new Logger("Playlists Service");
	private readonly clientBots = new Map<string, Map<string, PlaylistBotInfo>>();

	constructor(
		@InjectRepository(DBPlaylist)
		private readonly playlistsRepository: Repository<DBPlaylist>,
		@InjectRepository(DBPlaylistTrack)
		private readonly playlistTracksRepository: Repository<DBPlaylistTrack>,
		@InjectRepository(DBPlaylistMember)
		private readonly membersRepository: Repository<DBPlaylistMember>,
		private readonly attributeSourcesService: AttributeSourcesService,
		private readonly userManagerService: UserManagerService,
		private readonly attributeUploadService: AttributeUploadService,
		private readonly emitter: EventEmitter2,
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

	getBotInfo(pluginId: string, botId: string) {
		return this.clientBots.get(pluginId)?.get(botId) ?? null;
	}

	async create(
		owner:
			| {
					type: "user";
					user: DBUser;
			  }
			| {
					type: "bot";
					pluginId: string;
					botId: string;
			  },
		attributeSource: LoadedAttributeSource | null,
		attributes: AttributeValue[],
		visibility: PlaylistVisibility,
	) {
		const playlist = this.playlistsRepository.create({
			ownerUuid: (owner.type == "user" && owner.user.uuid) || undefined,
			ownerPluginId: (owner.type == "bot" && owner.pluginId) || undefined,
			ownerBotId: (owner.type == "bot" && owner.botId) || undefined,
			visibility,
		});
		await this.playlistsRepository.insert(playlist);

		const dbAttributes: DBPlaylistAttribute[] = [];
		try {
			const newAttributes =
				await this.attributeSourcesService.createPlaylistAttributes(
					playlist.uuid,
					attributes,
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

		playlist.attributes = dbAttributes;
		await this.attributeSourcesService.upsertPlaylistAttributes(
			playlist.uuid,
			attributeSource,
			dbAttributes,
		);

		emitServerEvent(this.emitter, "playlist.added", playlist);

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

		const before = await this.attributeSourcesService.getPlaylistAttributeRows(
			playlist.uuid,
		);

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

		const dbAttributes: DBPlaylistAttribute[] = [];
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
			attributeSource,
			dbAttributes,
		);

		const after = await this.attributeSourcesService.getPlaylistAttributeRows(
			playlist.uuid,
		);
		if (attributeSignature(before) !== attributeSignature(after)) {
			emitServerEvent(this.emitter, "playlist.attributes.updated", playlist);
		}

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

	async setVisibility(playlist: DBPlaylist, visibility: PlaylistVisibility) {
		if (playlist.visibility === visibility) {
			return;
		}

		await this.playlistsRepository.update(
			{
				uuid: playlist.uuid,
			},
			{
				visibility,
			},
		);

		playlist.visibility = visibility;
		emitServerEvent(this.emitter, "playlist.visibility.updated", playlist);
	}

	async findForUser(
		user: DBUser,
		options: {
			withAttributes?: boolean;
		} = {},
	) {
		const relations = { attributes: !!options.withAttributes };

		const [owned, memberships] = await Promise.all([
			this.playlistsRepository.find({
				where: { ownerUuid: user.uuid },
				relations,
			}),
			this.membersRepository.find({
				where: { userUuid: user.uuid },
				relations: { playlist: relations },
			}),
		]);

		const seen = new Set(owned.map((p) => p.uuid));
		const memberPlaylists = memberships
			.map((m) => m.playlist!)
			.filter((p) => p && !seen.has(p.uuid));

		return [...owned, ...memberPlaylists];
	}

	async getMemberRole(
		playlistUuid: string,
		userUuid: string,
	): Promise<PlaylistMemberRole | null> {
		const member = await this.membersRepository.findOne({
			where: { playlistUuid, userUuid },
			select: ["role"],
		});
		return member?.role ?? null;
	}

	async findMembers(playlistUuid: string): Promise<DBPlaylistMember[]> {
		return this.membersRepository.find({
			where: { playlistUuid },
			relations: { user: true },
			order: { dateAdded: "asc" },
		});
	}

	async upsertMember(
		playlist: DBPlaylist,
		userUuid: string,
		role: PlaylistMemberRole,
	): Promise<DBPlaylistMember> {
		const existing = await this.membersRepository.findOne({
			where: { playlistUuid: playlist.uuid, userUuid },
			select: ["role"],
		});

		await this.membersRepository.upsert(
			{ playlistUuid: playlist.uuid, userUuid, role },
			{
				conflictPaths: ["playlistUuid", "userUuid"],
				skipUpdateIfNoValuesChanged: true,
			},
		);

		if (existing?.role !== role) {
			emitServerEvent(this.emitter, "playlist.members.updated", playlist);
		}

		return this.membersRepository.findOneOrFail({
			where: { playlistUuid: playlist.uuid, userUuid },
			relations: { user: true },
		});
	}

	async removeMember(playlist: DBPlaylist, userUuid: string): Promise<void> {
		const result = await this.membersRepository.delete({
			playlistUuid: playlist.uuid,
			userUuid,
		});

		if (result.affected) {
			emitServerEvent(this.emitter, "playlist.members.updated", playlist);
		}
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
			relationLoadStrategy: "query",
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
			relationLoadStrategy: "query",
			take: options.amount,
			skip: options.offset,
		});
	}

	async addTracks(
		playlist: DBPlaylist,
		tracks: DBTrack[] | string[],
		actioner:
			| {
					type: "user";
					user: DBUser;
			  }
			| {
					type: "bot";
					pluginId: string;
					botId: string;
			  }
			| {
					type: "system";
			  },
	) {
		const before = await this.playlistTracksRepository.findBy({
			playlistUuid: playlist.uuid,
		});

		for (let i = 0; i < tracks.length; i += 500) {
			await this.playlistTracksRepository.upsert(
				tracks.slice(i, i + 500).map((track, ordinal) => ({
					trackUuid: typeof track == "string" ? track : track.uuid,
					playlistUuid: playlist.uuid,
					addedByUuid: (actioner.type == "user" && actioner.user?.uuid) || null,
					addedByPluginId:
						(actioner.type == "bot" && actioner.pluginId) || null,
					addedByBotId: (actioner.type == "bot" && actioner.pluginId) || null,
					ordinal: i + ordinal,
				})),
				{
					conflictPaths: ["trackUuid", "playlistUuid"],
					skipUpdateIfNoValuesChanged: true,
				},
			);
		}

		await this.updateDateModified(playlist);

		const after = await this.playlistTracksRepository.findBy({
			playlistUuid: playlist.uuid,
		});
		if (
			this.playlistTrackSignature(before) !== this.playlistTrackSignature(after)
		) {
			emitServerEvent(this.emitter, "playlist.tracklist.updated", playlist);
		}
	}

	async removeTracks(playlist: DBPlaylist, tracks: DBTrack[] | string[]) {
		const before = await this.playlistTracksRepository.findBy({
			playlistUuid: playlist.uuid,
		});

		await this.playlistTracksRepository.delete({
			playlistUuid: playlist.uuid,
			trackUuid: In(
				tracks.map((track) => (typeof track == "string" ? track : track.uuid)),
			),
		});
		await this.updateDateModified(playlist);

		const after = await this.playlistTracksRepository.findBy({
			playlistUuid: playlist.uuid,
		});
		if (
			this.playlistTrackSignature(before) !== this.playlistTrackSignature(after)
		) {
			emitServerEvent(this.emitter, "playlist.tracklist.updated", playlist);
		}
	}

	private playlistTrackSignature(tracks: DBPlaylistTrack[]): string {
		return tracks
			.map(
				(track) =>
					`${track.trackUuid}:${track.addedByUuid ?? ""}:${track.ordinal}`,
			)
			.sort()
			.join("|");
	}

	async delete(playlist: DBPlaylist) {
		await this.playlistsRepository.remove(playlist);
		emitServerEvent(this.emitter, "playlist.removed", playlist);
	}

	createPlaylistClient(plugin: LoadedPlugin): ReadOnlyPlaylistClient;
	createPlaylistClient(
		plugin: LoadedPlugin,
		botInfo: PlaylistBotInfo,
	): WritablePlaylistClient;
	createPlaylistClient(
		plugin: LoadedPlugin,
		botInfo?: PlaylistBotInfo,
	): ReadOnlyPlaylistClient | WritablePlaylistClient {
		const readOnlyClient: ReadOnlyPlaylistClient = {
			getUserPlaylistUuids: async (uuid) => {
				const playlists = await this.playlistsRepository.find({
					where: {
						ownerUuid: uuid,
					},
					select: ["uuid"],
				});
				return playlists.map(({ uuid }) => uuid);
			},
			getMemberPlaylistUuids: async (userUuid) => {
				const memberships = await this.membersRepository.find({
					where: { userUuid },
					select: ["playlistUuid"],
				});
				return memberships.map(({ playlistUuid }) => playlistUuid);
			},
			getBotPlaylistUuids: async (pluginId, botId) => {
				const where: FindOptionsWhere<DBPlaylist> = {
					ownerPluginId: pluginId,
				};
				if (botId) {
					where.ownerBotId = botId;
				}

				const playlists = await this.playlistsRepository.find({
					where,
					select: ["uuid"],
				});
				return playlists.map(({ uuid }) => uuid);
			},
			getPublicPlaylistUuids: async () => {
				const playlists = await this.playlistsRepository.find({
					where: {
						visibility: PlaylistVisibility.PUBLIC,
						ownerUuid: IsNull(),
					},
					select: ["uuid"],
				});
				return playlists.map(({ uuid }) => uuid);
			},
			getPlaylistBots: () => {
				const bots: PlaylistPluginBot[] = [];
				for (const [key, map] of this.clientBots) {
					for (const info of map.values()) {
						bots.push({
							pluginId: key,
							botId: info.id,
							botName: info.name,
						});
					}
				}
				return bots;
			},
			getPlaylist: async (uuid, { relations } = {}) => {
				const playlist = await this.playlistsRepository.findOne({
					where: {
						uuid,
					},
					relationLoadStrategy: "query",
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
				});

				playlist?.tracks?.sort(
					(a, b) => a.dateAdded - b.dateAdded || a.ordinal - b.ordinal,
				);

				return playlist?.toSavedResponse() ?? null;
			},
			getPlaylists: async (uuids, { relations } = {}) => {
				const playlists = await this.playlistsRepository.find({
					where: {
						uuid: In(uuids),
					},
					relationLoadStrategy: "query",
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
				});

				for (const playlist of playlists) {
					playlist?.tracks?.sort(
						(a, b) => a.dateAdded - b.dateAdded || a.ordinal - b.ordinal,
					);
				}

				return playlists.map((p) => p.toSavedResponse());
			},
			getPlaylistMembers: async (playlistUuid) => {
				const members = await this.findMembers(playlistUuid);
				return members.map((m) => ({
					playlistUuid: m.playlistUuid,
					userUuid: m.userUuid,
					role: m.role as "collaborator" | "viewer",
					dateAdded: new Date(m.dateAdded),
					user: m.user?.toSavedResponse() ?? null,
				}));
			},
		};

		if (!botInfo) {
			return readOnlyClient;
		}

		const registeredBots = this.clientBots.get(plugin.package.name);
		if (registeredBots) {
			if (registeredBots.has(botInfo.id)) {
				throw new Error(
					`Client with ID "${botInfo.id}" has already been registered`,
				);
			}
			registeredBots.set(botInfo.id, { ...botInfo });
		} else {
			this.clientBots.set(
				plugin.package.name,
				new Map([[botInfo.id, { ...botInfo }]]),
			);
		}

		const writableClient: WritablePlaylistClient = {
			...readOnlyClient,
			addToPlaylist: async (uuid, trackUuids, options = {}) => {
				const playlist = await this.findByUuid(uuid);

				if (!playlist) {
					throw new Error("Playlist doesn't exist");
				}

				let user: DBUser | null = null;
				if (options.asUser) {
					user = await this.userManagerService.findOne(options.asUser);

					if (!user) {
						throw new Error("User doesn't exist");
					}

					if (user.uuid !== playlist.playlist.ownerUuid) {
						const role = await this.getMemberRole(
							playlist.playlist.uuid,
							user.uuid,
						);
						if (role !== PlaylistMemberRole.COLLABORATOR) {
							throw new Error("User cannot modify playlist");
						}
					}
				}

				await this.addTracks(
					playlist.playlist,
					trackUuids,
					user
						? {
								type: "user",
								user,
							}
						: {
								type: "bot",
								pluginId: plugin.package.name,
								botId: botInfo.id,
							},
				);
			},
			removeFromPlaylist: async (uuid, trackUuids, options = {}) => {
				const playlist = await this.findByUuid(uuid);

				if (!playlist) {
					throw new Error("Playlist doesn't exist");
				}

				let user: DBUser | null = null;
				if (options.asUser) {
					user = await this.userManagerService.findOne(options.asUser);

					if (!user) {
						throw new Error("User doesn't exist");
					}

					if (user.uuid !== playlist.playlist.ownerUuid) {
						const role = await this.getMemberRole(
							playlist.playlist.uuid,
							user.uuid,
						);
						if (role !== PlaylistMemberRole.COLLABORATOR) {
							throw new Error("User cannot modify playlist");
						}
					}
				}

				await this.removeTracks(playlist.playlist, trackUuids);
			},
			createPlaylist: async ({ ownerUuid, attributes, visibility } = {}) => {
				let owner: DBUser | null = null;
				if (ownerUuid) {
					owner = await this.userManagerService.findOne(ownerUuid);
					if (!owner) {
						throw new Error("User doesn't exist");
					}
				}

				let attributeSource: LoadedAttributeSource | null = null;
				if (attributes?.sourceId) {
					attributeSource = this.attributeSourcesService.getAttributeSource(
						plugin.package.name,
						attributes.sourceId,
					);
					if (!attributeSource) {
						throw new Error("Attribute source not registered");
					}
				}

				const playlist = await this.create(
					owner
						? {
								type: "user",
								user: owner,
							}
						: {
								type: "bot",
								pluginId: plugin.package.name,
								botId: botInfo.id,
							},
					attributeSource,
					attributes?.attributes ?? [],
					(visibility ?? owner)
						? PlaylistVisibility.PUBLIC
						: PlaylistVisibility.UNLISTED,
				);
				return playlist.uuid;
			},
			deletePlaylist: async (uuid, options = {}) => {
				const playlist = await this.findByUuid(uuid);

				if (!playlist) {
					throw new Error("Playlist doesn't exist");
				}

				let user: DBUser | null = null;
				if (options.asUser) {
					user = await this.userManagerService.findOne(options.asUser);

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

				let attributeSource: LoadedAttributeSource | null = null;
				if (attributeSourceId) {
					attributeSource = this.attributeSourcesService.getAttributeSource(
						plugin.package.name,
						attributeSourceId,
					);
					if (!attributeSource) {
						throw new Error("Attribute source not registered");
					}
				}

				let user: DBUser | null = null;
				if (options.asUser) {
					user = await this.userManagerService.findOne(options.asUser);

					if (!user) {
						throw new Error("User doesn't exist");
					}

					if (user.uuid != playlist.playlist.ownerUuid) {
						throw new Error("User cannot update playlist attributes");
					}
				}

				await this.updateAttributes(
					playlist.playlist,
					attributes,
					attributeSource,
				);
			},
			addPlaylistMember: async (playlistUuid, userUuid, role) => {
				const playlist = await this.playlistsRepository.findOneBy({
					uuid: playlistUuid,
				});
				if (!playlist) {
					throw new Error("Playlist doesn't exist");
				}
				await this.upsertMember(playlist, userUuid, role as PlaylistMemberRole);
			},
			removePlaylistMember: async (playlistUuid, userUuid) => {
				const playlist = await this.playlistsRepository.findOneBy({
					uuid: playlistUuid,
				});
				if (!playlist) {
					throw new Error("Playlist doesn't exist");
				}
				await this.removeMember(playlist, userUuid);
			},
			updatePlaylistVisibility: async (playlistUuid, visibility) => {
				const playlist = await this.playlistsRepository.findOneBy({
					uuid: playlistUuid,
				});
				if (!playlist) {
					throw new Error("Playlist doesn't exist");
				}
				switch (visibility) {
					case "private":
						await this.setVisibility(playlist, PlaylistVisibility.PRIVATE);
						break;
					case "public":
						await this.setVisibility(playlist, PlaylistVisibility.PUBLIC);
						break;
					case "unlisted":
						await this.setVisibility(playlist, PlaylistVisibility.UNLISTED);
						break;
				}
			},
		};

		return writableClient;
	}

	findPublic(
		options: {
			withAttributes?: boolean;
		} = {},
	) {
		return this.playlistsRepository.find({
			where: {
				visibility: PlaylistVisibility.PUBLIC,
				ownerUuid: IsNull(),
			},
			order: {
				dateModified: "desc",
			},
			relations: {
				attributes: options.withAttributes,
			},
		});
	}
}
