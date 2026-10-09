import { Injectable, Logger } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import {
	AlbumIdentifier,
	AlbumInformationHelper,
	Identity,
	TrackIdentifier,
} from "@sdk";
import { DeregistrationBlockedError } from "src/util/deregistration-blocked.error";
import { DBAlbumArtist } from "src/albums/entity/album-artist.entity";
import { DBAlbumIdentity } from "src/albums/entity/album-identity.entity";
import { DBAlbumTrack } from "src/albums/entity/album-track.entity";
import { DBAlbum } from "src/albums/entity/album.entity";
import { DBArtist } from "src/artist-manager/entity/artist.entity";
import { ExternalUrlsService } from "src/external-urls/external-urls.service";
import { orderIdentifiers } from "src/identifiers/identifiers.util";
import { ExistingDependency } from "src/identifiers/interface/existing-identifier-dependency.interface";
import { LoadedIdentifier } from "src/identifiers/interface/loaded-identifier";
import { LoadedPlugin } from "src/plugins/interface/loaded-plugin.interface";
import { DBTrack } from "src/tracks/entities/track.entity";
import { resolveRelationLoadStrategy } from "src/util/relation-load-strategy.util";
import { EventEmitter2 } from "@nestjs/event-emitter";
import { emitServerEvent } from "src/util/emitter.util";
import {
	DataSource,
	DeepPartial,
	FindOptionsRelations,
	FindOptionsSelect,
	FindOptionsSelectByString,
	FindManyOptions,
	FindOptionsWhere,
	In,
	Repository,
} from "typeorm";

@Injectable()
export class AlbumManagerService {
	private readonly logger = new Logger("Album Manager Service");

	private readonly identifiers = new Map<
		string,
		Map<string, LoadedIdentifier<AlbumIdentifier>>
	>();
	private orderedIdentifiers: LoadedIdentifier<AlbumIdentifier>[] = [];
	private readonly trackIdentifiers: ExistingDependency[] = [];

	constructor(
		@InjectRepository(DBAlbum)
		private readonly albumsRepository: Repository<DBAlbum>,
		@InjectRepository(DBAlbumArtist)
		private readonly albumArtistsRepository: Repository<DBAlbumArtist>,
		@InjectRepository(DBAlbumIdentity)
		private readonly identitiesRepository: Repository<DBAlbumIdentity>,
		@InjectRepository(DBAlbumTrack)
		private readonly albumTracksRepository: Repository<DBAlbumTrack>,
		private readonly dataSource: DataSource,
		private readonly externalUrlsService: ExternalUrlsService,
		private readonly emitter: EventEmitter2,
	) {}

	getIdentifiers() {
		return [...this.orderedIdentifiers];
	}

	count(where: FindOptionsWhere<DBAlbum> | FindOptionsWhere<DBAlbum>[]) {
		return this.albumsRepository.countBy(where);
	}

	queryBuilder(alias?: string) {
		return this.albumsRepository.createQueryBuilder(alias);
	}

	findMany(options: {
		amount: number;
		offset?: number;
		withAttributes?: boolean;
		withIdentities?: boolean;
		withArtists?: boolean;
		where?: FindOptionsWhere<DBAlbum> | FindOptionsWhere<DBAlbum>[];
		select?: FindOptionsSelect<DBAlbum> | FindOptionsSelectByString<DBAlbum>;
	}) {
		const relations: FindOptionsRelations<DBAlbum> = {
			attributes: options.withAttributes,
			identities: options.withIdentities,
			artists: !!options.withArtists && {
				artist: {
					attributes: true,
				},
			},
		};

		return this.albumsRepository.find({
			where: options.where,
			take: options.amount,
			skip: options.offset,
			relationLoadStrategy: resolveRelationLoadStrategy(
				this.albumsRepository.metadata,
				relations,
			),
			select: options.select,
			relations,
		});
	}

	findManyRaw(options: FindManyOptions<DBAlbum>) {
		return this.albumsRepository.find({
			...options,
			relationLoadStrategy:
				options.relationLoadStrategy ??
				resolveRelationLoadStrategy(
					this.albumsRepository.metadata,
					options.relations,
				),
		});
	}

	async updateAttributionRunId(runId: string, albumUuids: string[]) {
		await this.albumsRepository.update(
			{
				uuid: In(albumUuids),
			},
			{
				lastAttributionRunId: runId,
			},
		);
	}

	async findForArtist(
		artist: DBArtist,
		options: {
			withIdentities?: boolean;
			withAttributes?: boolean;
			withArtists?: boolean;
			withArtistIdentities?: boolean;
			withArtistAttributes?: boolean;
			withTracks?: boolean;
			withTrackIdentities?: boolean;
			withTrackAttributes?: boolean;
		},
	) {
		const albums = await this.albumsRepository.find({
			where: {
				artists: {
					artistUuid: artist.uuid,
				},
			},
			select: ["uuid"],
		});

		const relations: FindOptionsRelations<DBAlbumArtist> = {
			album: {
				identities: options.withIdentities,
				attributes: options.withAttributes,
				artists: options.withArtists && {
					artist: {
						identities: options.withArtistIdentities,
						attributes: options.withArtistAttributes,
					},
				},
				tracks: options.withTracks && {
					track: {
						identities: options.withTrackIdentities,
						attributes: options.withTrackAttributes,
					},
				},
			},
		};

		const albumArtists = await this.albumArtistsRepository.find({
			where: {
				artistUuid: artist.uuid,
				albumUuid: In(albums.map((album) => album.uuid)),
			},
			relationLoadStrategy: resolveRelationLoadStrategy(
				this.albumArtistsRepository.metadata,
				relations,
			),
			relations,
		});

		const uniqueMap = new Map<string, DBAlbumArtist>();

		for (const albumArtist of albumArtists) {
			if (!uniqueMap.has(albumArtist.albumUuid)) {
				uniqueMap.set(albumArtist.albumUuid, albumArtist);
			}
		}

		return Array.from(uniqueMap.values());
	}

	async findOne(
		uuid: string,
		options: {
			withAttributes?: boolean;
			withIdentities?: boolean;
			withArtists?: boolean;
			withArtistIdentities?: boolean;
			withArtistAttributes?: boolean;
			withTracks?: boolean;
			withTrackIdentities?: boolean;
			withTrackAttributes?: boolean;
			withTrackArtists?: boolean;
			withTrackArtistIdentities?: boolean;
			withTrackArtistAttributes?: boolean;
		} = {},
	) {
		const relations: FindOptionsRelations<DBAlbum> = {
			attributes: options.withAttributes,
			identities: options.withIdentities,
			artists: !!options.withArtists && {
				artist: {
					attributes: options.withArtistAttributes,
					identities: options.withArtistIdentities,
				},
			},
			tracks: !!options.withTracks && {
				track: {
					artists: !!options.withTrackArtists && {
						artist: {
							identities: options.withTrackArtistIdentities,
							attributes: options.withTrackArtistAttributes,
						},
					},
					identities: options.withTrackIdentities,
					attributes: options.withTrackAttributes,
				},
			},
		};

		const album = await this.albumsRepository.findOne({
			where: {
				uuid,
			},
			relationLoadStrategy: resolveRelationLoadStrategy(
				this.albumsRepository.metadata,
				relations,
			),
			relations,
		});

		return album;
	}

	async setRunId(album: DBAlbum, runId: string, type: "identity") {
		const partial: Record<typeof type, DeepPartial<DBAlbum>> = {
			identity: {
				lastIdentificationRunId: runId,
			},
		};

		await this.albumsRepository.update({ uuid: album.uuid }, partial[type]);
	}

	public async resolveAlbum(
		pluginId: string,
		identifierId: string,
		identity: string,
		createIfMissing: true,
	): Promise<string>;
	public async resolveAlbum(
		pluginId: string,
		identifierId: string,
		identity: string,
		createIfMissing?: false,
	): Promise<string | null>;
	public async resolveAlbum(
		pluginId: string,
		identifierId: string,
		identity: string,
		createIfMissing = false,
	): Promise<string | null> {
		// 1. Check for existing mapping
		const existingIdentity = await this.identitiesRepository.findOne({
			where: {
				pluginId,
				identifierId,
				identity,
			},
			select: ["albumUuid"],
		});

		if (existingIdentity) {
			return existingIdentity.albumUuid;
		}

		if (!createIfMissing) {
			return null;
		}

		// 2. Create a "Headless" Album Stub
		// No title, no artist yet. Just a UUID to anchor future metadata.
		const saved = await this.dataSource.transaction(async (tm) => {
			const albRepo = tm.getRepository(DBAlbum);
			const idRepo = tm.getRepository(DBAlbumIdentity);

			const newAlbum = albRepo.create({
				title: "Unknown Album",
				dateAdded: Date.now(),
			});

			const saved = await albRepo.save(newAlbum);

			await idRepo.insert({
				pluginId,
				identifierId,
				identity,
				albumUuid: saved.uuid,
				ordinal: 0,
				originalAlbumUuid: saved.uuid,
			});

			return saved;
		});

		emitServerEvent(this.emitter, "album.added", saved);

		return saved.uuid;
	}

	public async setTrackLinks(
		track: DBTrack,
		albumUuids: string[],
		pluginId: string,
		identifierId: string,
		// Optional: Metadata sources often provide position
		position?: { disc: number; track: number },
	) {
		const before = await this.getTrackAlbumLinks(track.uuid);

		await this.dataSource.transaction(async (tm) => {
			const atRepo = tm.getRepository(DBAlbumTrack);

			// Clear old links for this specific plugin/identifier to avoid stale data
			await atRepo.delete({
				trackUuid: track.uuid,
				pluginId,
				identifierId,
			});

			if (albumUuids.length > 0) {
				await atRepo.insert(
					albumUuids.map((albumUuid) =>
						atRepo.create({
							trackUuid: track.uuid,
							albumUuid,
							pluginId,
							identifierId,
							discNumber: position?.disc ?? 1,
							trackNumber: position?.track ?? 0,
						}),
					),
				);
			}
		});

		const after = await this.getTrackAlbumLinks(track.uuid);
		if (this.trackAlbumSignature(before) !== this.trackAlbumSignature(after)) {
			emitServerEvent(this.emitter, "track.albums.updated", track);
		}

		await this.emitAlbumTracklistsUpdated(
			this.changedAlbumUuids(before, albumUuids, pluginId, identifierId),
		);
	}

	public async clearTrackLinks(
		track: DBTrack,
		pluginId: string,
		identifierId: string,
	) {
		const before = await this.getTrackAlbumLinks(track.uuid);

		await this.albumTracksRepository.delete({
			trackUuid: track.uuid,
			pluginId,
			identifierId,
		});

		const after = await this.getTrackAlbumLinks(track.uuid);
		if (this.trackAlbumSignature(before) !== this.trackAlbumSignature(after)) {
			emitServerEvent(this.emitter, "track.albums.updated", track);
		}

		await this.emitAlbumTracklistsUpdated(
			this.changedAlbumUuids(before, [], pluginId, identifierId),
		);
	}

	private changedAlbumUuids(
		before: DBAlbumTrack[],
		after: string[],
		pluginId: string,
		identifierId: string,
	): string[] {
		const beforeUuids = new Set(
			before
				.filter(
					(link) =>
						link.pluginId === pluginId && link.identifierId === identifierId,
				)
				.map((link) => link.albumUuid),
		);
		const afterUuids = new Set(after);

		const changed = new Set<string>();
		for (const uuid of beforeUuids) {
			if (!afterUuids.has(uuid)) {
				changed.add(uuid);
			}
		}
		for (const uuid of afterUuids) {
			if (!beforeUuids.has(uuid)) {
				changed.add(uuid);
			}
		}
		return Array.from(changed);
	}

	private async emitAlbumTracklistsUpdated(uuids: string[]) {
		if (!uuids.length) {
			return;
		}

		const albums = await this.albumsRepository.findBy({ uuid: In(uuids) });
		for (const album of albums) {
			emitServerEvent(this.emitter, "album.tracklist.updated", album);
		}
	}

	private getTrackAlbumLinks(trackUuid: string) {
		return this.albumTracksRepository.findBy({ trackUuid });
	}

	private trackAlbumSignature(links: DBAlbumTrack[]): string {
		return links
			.map(
				(link) =>
					`${link.albumUuid}:${link.pluginId}:${link.identifierId}:${link.discNumber}:${link.trackNumber}`,
			)
			.sort()
			.join("|");
	}

	private getAlbumArtistLinks(albumUuid: string) {
		return this.albumArtistsRepository.findBy({ albumUuid });
	}

	private albumArtistSignature(links: DBAlbumArtist[]): string {
		return links
			.map(
				(link) =>
					`${link.artistUuid}:${link.pluginId}:${link.identifierId}:${link.ordinal}:${link.joinPhrase ?? ""}`,
			)
			.sort()
			.join("|");
	}

	private async clearArtistLinksInternal(
		album: DBAlbum,
		pluginId: string,
		identifierId: string,
	) {
		await this.albumArtistsRepository.delete({
			albumUuid: album.uuid,
			pluginId,
			identifierId,
		});
	}

	async clearArtistLinks(
		album: DBAlbum,
		pluginId: string,
		identifierId: string,
	) {
		const before = await this.getAlbumArtistLinks(album.uuid);

		await this.clearArtistLinksInternal(album, pluginId, identifierId);

		const after = await this.getAlbumArtistLinks(album.uuid);
		if (
			this.albumArtistSignature(before) !== this.albumArtistSignature(after)
		) {
			emitServerEvent(this.emitter, "album.artists.updated", album);
		}
	}

	async setArtistLinks(
		album: DBAlbum,
		artistUuids: string[],
		pluginId: string,
		identifierId: string,
	) {
		const before = await this.getAlbumArtistLinks(album.uuid);

		await this.clearArtistLinksInternal(album, pluginId, identifierId);
		await this.albumArtistsRepository.insert(
			artistUuids.map((artistUuid, ordinal) => ({
				albumUuid: album.uuid,
				artistUuid,
				pluginId,
				identifierId,
				ordinal,
			})),
		);

		const after = await this.getAlbumArtistLinks(album.uuid);
		if (
			this.albumArtistSignature(before) !== this.albumArtistSignature(after)
		) {
			emitServerEvent(this.emitter, "album.artists.updated", album);
		}
	}

	async setJoinPhrase(
		album: DBAlbum,
		artistUuid: string,
		joinPhrase: string | null,
	) {
		const before = await this.getAlbumArtistLinks(album.uuid);

		await this.albumArtistsRepository.update(
			{
				albumUuid: album.uuid,
				artistUuid,
			},
			{
				joinPhrase,
			},
		);

		const after = await this.getAlbumArtistLinks(album.uuid);
		if (
			this.albumArtistSignature(before) !== this.albumArtistSignature(after)
		) {
			emitServerEvent(this.emitter, "album.artists.updated", album);
		}
	}

	public unregisterIdentifier(
		identifier: AlbumIdentifier,
		plugin: LoadedPlugin,
	) {
		const pluginIdentifiers = this.identifiers.get(plugin.package.name);
		if (!pluginIdentifiers?.has(identifier.id)) {
			return;
		}

		const targetKey = `${plugin.package.name}:${identifier.id}`;
		const allLoaded = Array.from(this.identifiers.values()).flatMap((m) =>
			Array.from(m.values()),
		);

		const blockedBy = allLoaded
			.filter(
				(loaded) =>
					!(
						loaded.plugin.package.name === plugin.package.name &&
						loaded.identifier.id === identifier.id
					),
			)
			.filter((loaded) =>
				loaded.identifier.getDependencies().some((dep) => {
					if (dep.pluginId !== null) {
						return `${dep.pluginId}:${dep.sourceId}` === targetKey;
					}
					return dep.sourceId === identifier.id;
				}),
			)
			.map(
				(loaded) =>
					`AlbumIdentifier:${loaded.plugin.package.name}:${loaded.identifier.id}`,
			);

		if (blockedBy.length) {
			throw new DeregistrationBlockedError(
				`AlbumIdentifier:${targetKey}`,
				blockedBy,
			);
		}

		pluginIdentifiers.delete(identifier.id);
		if (pluginIdentifiers.size === 0) {
			this.identifiers.delete(plugin.package.name);
		}
		this.orderIdentifiers();
		this.logger.log(
			`Plugin "${plugin.package.name}" unregistered Identifier "${identifier.id}"`,
		);
	}

	public unregisterTrackIdentifier(
		identifier: TrackIdentifier,
		plugin: LoadedPlugin,
	) {
		const idx = this.trackIdentifiers.findIndex(
			(dep) =>
				dep.pluginId === plugin.package.name && dep.sourceId === identifier.id,
		);
		if (idx !== -1) {
			this.trackIdentifiers.splice(idx, 1);
			this.orderIdentifiers();
		}
	}

	public registerIdentifier(identifier: AlbumIdentifier, plugin: LoadedPlugin) {
		const pluginIdentifiers = this.identifiers.get(plugin.package.name);
		if (pluginIdentifiers) {
			if (pluginIdentifiers.has(identifier.id)) {
				throw new Error(
					`Plugin has already registered Identifier with ID "${identifier.id}"`,
				);
			}
			pluginIdentifiers.set(identifier.id, { identifier, plugin });
		} else {
			this.identifiers.set(
				plugin.package.name,
				new Map([[identifier.id, { identifier, plugin }]]),
			);
		}

		this.orderIdentifiers();
		this.logger.log(
			`Plugin "${plugin.package.name}" registered Identifier "${identifier.id}"`,
		);
	}

	private orderIdentifiers() {
		this.orderedIdentifiers = orderIdentifiers(
			Array.from(this.identifiers.values()).flatMap((map) =>
				Array.from(map.values()),
			),
			this.trackIdentifiers,
		);
	}

	public registerTrackIdentifier(
		identifier: TrackIdentifier,
		plugin: LoadedPlugin,
	) {
		this.trackIdentifiers.push({
			sourceId: identifier.id,
			pluginId: plugin.package.name,
		});
		this.orderIdentifiers();
	}

	findIdentities(album: DBAlbum | string) {
		return this.identitiesRepository.findBy({
			albumUuid: typeof album == "string" ? album : album.uuid,
		});
	}

	public async getInformationHelper(
		album: DBAlbum,
		getIdentities?: (id: string, pluginId?: string | null) => Identity[] | null,
	): Promise<AlbumInformationHelper> {
		if (!getIdentities) {
			const identities = await this.findIdentities(album);

			getIdentities = (id, pluginId) => {
				return identities
					.filter(
						(identity) =>
							identity.identifierId == id &&
							(!pluginId || pluginId == identity.pluginId),
					)
					.map((identity) => identity.toIdentity());
			};
		}

		return {
			getAlbumUuid: () => album.uuid,
			getIdentity: (id, pluginId, multiple) => {
				const matches = getIdentities(id, pluginId);

				if (!matches?.length) {
					return null;
				}

				if (multiple) {
					return matches;
				}
				return matches[0] as any;
			},
		};
	}

	public async getExternalUrls(album: DBAlbum) {
		const identities = (await this.findIdentities(album)).map((identity) =>
			identity.toIdentity(),
		);
		return this.externalUrlsService.getAlbumUrls({
			getAlbumUuid: () => album.uuid,
			getIdentity: (id, pluginId, multiple) => {
				const matches = identities.filter(
					(identity) =>
						identity.identityId == id &&
						(!pluginId || pluginId == identity.pluginId),
				);
				if (!matches.length) {
					return null;
				}
				if (multiple) {
					return matches;
				}
				return matches[0] as any;
			},
		});
	}

	async cleanIdentities() {
		const identifiers: { pluginId: string; identityId: string }[] =
			this.trackIdentifiers.map((identifier) => ({
				pluginId: identifier.pluginId,
				identityId: identifier.sourceId,
			}));
		for (const [pluginId, entry] of this.identifiers) {
			for (const identityId of entry.keys()) {
				identifiers.push({ pluginId, identityId });
			}
		}

		let affectedIdentityAlbumUuids: string[] = [];
		let affectedArtistLinkAlbumUuids: string[] = [];

		if (!identifiers.length) {
			const rows = await this.identitiesRepository
				.createQueryBuilder()
				.distinct(true)
				.select("identity.albumUuid", "albumUuid")
				.from(DBAlbumIdentity, "identity")
				.getRawMany<{ albumUuid: string }>();

			affectedIdentityAlbumUuids = rows.map((row) => row.albumUuid);

			await this.identitiesRepository.deleteAll();
		} else {
			const conditionStrings: string[] = [];
			const queryParameters: Record<string, string> = {};

			for (const [index, { pluginId, identityId }] of identifiers.entries()) {
				const pluginKey = `p_${index}`;
				const identifierKey = `i_${index}`;

				conditionStrings.push(
					`(pluginId = :${pluginKey} AND identifierId = :${identifierKey})`,
				);

				queryParameters[pluginKey] = pluginId;
				queryParameters[identifierKey] = identityId;
			}

			const condition = `NOT (${conditionStrings.join(" OR ")})`;

			const identityRows = await this.identitiesRepository
				.createQueryBuilder()
				.distinct(true)
				.select("identity.albumUuid", "albumUuid")
				.from(DBAlbumIdentity, "identity")
				.where(condition, queryParameters)
				.getRawMany<{ albumUuid: string }>();

			affectedIdentityAlbumUuids = identityRows.map((row) => row.albumUuid);

			const artistRows = await this.albumArtistsRepository
				.createQueryBuilder()
				.distinct(true)
				.select("link.albumUuid", "albumUuid")
				.from(DBAlbumArtist, "link")
				.where(condition, queryParameters)
				.getRawMany<{ albumUuid: string }>();

			affectedArtistLinkAlbumUuids = artistRows.map((row) => row.albumUuid);

			await this.identitiesRepository
				.createQueryBuilder()
				.delete()
				.from(DBAlbumIdentity)
				.where(condition, queryParameters)
				.execute();

			await this.albumArtistsRepository
				.createQueryBuilder()
				.delete()
				.from(DBAlbumArtist)
				.where(condition, queryParameters)
				.execute();
		}

		const allUuids = Array.from(
			new Set([...affectedIdentityAlbumUuids, ...affectedArtistLinkAlbumUuids]),
		);
		if (!allUuids.length) {
			return;
		}

		const identitySet = new Set(affectedIdentityAlbumUuids);
		const artistSet = new Set(affectedArtistLinkAlbumUuids);
		const albums = await this.albumsRepository.findBy({ uuid: In(allUuids) });

		for (const album of albums) {
			if (identitySet.has(album.uuid)) {
				emitServerEvent(this.emitter, "album.identities.updated", album);
			}
			if (artistSet.has(album.uuid)) {
				emitServerEvent(this.emitter, "album.artists.updated", album);
			}
		}
	}

	async removeOrphanedAlbums() {
		const subQueryBuilder = this.albumsRepository.manager.createQueryBuilder();

		const albumsWithTracks = subQueryBuilder
			.subQuery()
			.select('track."albumUuid"')
			.from(DBAlbumTrack, "track")
			.where('track."albumUuid" IS NOT NULL')
			.getQuery();

		const affected = await this.albumsRepository
			.createQueryBuilder("album")
			.select("album.uuid", "uuid")
			.where(`album.uuid NOT IN ${albumsWithTracks}`)
			.getRawMany<{ uuid: string }>();

		const albums = affected.length
			? await this.albumsRepository.findBy({
					uuid: In(affected.map((row) => row.uuid)),
				})
			: [];

		await this.albumsRepository
			.createQueryBuilder()
			.delete()
			.from(DBAlbum)
			.where(`uuid NOT IN ${albumsWithTracks}`)
			.execute();

		for (const album of albums) {
			emitServerEvent(this.emitter, "album.removed", album);
		}
	}

	public async forEachAlbumId(
		callback: (albumUuid: string, cancel: () => void) => void | Promise<void>,
	) {
		const CHUNK_SIZE = 1_000;

		let isCancelled = false;
		let processed = 0;

		for (let i = 0; true; i++) {
			if (isCancelled) {
				return;
			}
			const albums = await this.findMany({
				amount: CHUNK_SIZE,
				offset: CHUNK_SIZE * i,
			});
			if (!albums.length || isCancelled) {
				break;
			}
			for (const album of albums) {
				await callback(album.uuid, () => {
					isCancelled = true;
				});
				if (isCancelled) {
					return;
				}
				if (++processed % 10 === 0) {
					await new Promise<void>((resolve) => setImmediate(resolve));
				}
			}
		}
	}
}
