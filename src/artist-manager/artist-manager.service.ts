import { Injectable, Logger } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import {
	ArtistIdentifier,
	ArtistInformationHelper,
	Identity,
	TrackIdentifier,
} from "@sdk";
import { AlbumManagerService } from "src/album-manager/album-manager.service";
import { ArtistIdentityTarget } from "src/artist-manager/enum/artist-identity-target.enum";
import { ArtistIdentificationResult } from "src/artist-manager/interface/artist-identification-result.interface";
import { DBArtistAttribute } from "src/attributes/entities/artist-attribute.entity";
import { ExternalUrlsService } from "src/external-urls/external-urls.service";
import { orderIdentifiers } from "src/identifiers/identifiers.util";
import { ExistingDependency } from "src/identifiers/interface/existing-identifier-dependency.interface";
import { LoadedIdentifier } from "src/identifiers/interface/loaded-identifier";
import { LoadedPlugin } from "src/plugins/interface/loaded-plugin.interface";
import { TrackManagerService } from "src/track-manager/track-manager.service";
import { DBTrack } from "src/tracks/entities/track.entity";
import {
	Repository,
	DataSource,
	In,
	FindOptionsWhere,
	FindManyOptions,
} from "typeorm";
import { DBArtistIdentity } from "./entity/artist-identity.entity";
import { DBArtist } from "./entity/artist.entity";
import { DBTrackArtist } from "./entity/track-artist.entity";
import { DBAlbumArtist } from "src/albums/entity/album-artist.entity";

@Injectable()
export class ArtistManagerService {
	private readonly logger = new Logger("Artist Manager Service");

	private readonly identifiers = new Map<
		string,
		Map<string, LoadedIdentifier<ArtistIdentifier>>
	>();
	private orderedIdentifiers: LoadedIdentifier<ArtistIdentifier>[] = [];
	private readonly trackIdentifiers: ExistingDependency[] = [];

	constructor(
		@InjectRepository(DBArtist)
		private readonly artistsRepository: Repository<DBArtist>,
		@InjectRepository(DBArtistIdentity)
		private readonly identitiesRepository: Repository<DBArtistIdentity>,
		@InjectRepository(DBTrackArtist)
		private readonly trackArtistsRepository: Repository<DBTrackArtist>,
		private readonly externalUrlsService: ExternalUrlsService,
		private readonly trackManagerService: TrackManagerService,
		private readonly albumManagerService: AlbumManagerService,
		private readonly dataSource: DataSource,
	) {}

	async setJoinPhrase(
		trackUuid: string,
		artistUuid: string,
		joinPhrase: string | null,
	) {
		await this.trackArtistsRepository.update(
			{
				trackUuid,
				artistUuid,
			},
			{
				joinPhrase,
			},
		);
	}

	async resolveArtist(
		pluginId: string,
		identifierId: string,
		identityValue: string,
		target: ArtistIdentityTarget,
		createIfMissing?: false,
	): Promise<string | null>;
	async resolveArtist(
		pluginId: string,
		identifierId: string,
		identityValue: string,
		target: ArtistIdentityTarget,
		createIfMissing: true,
	): Promise<string>;
	async resolveArtist(
		pluginId: string,
		identifierId: string,
		identityValue: string,
		target: ArtistIdentityTarget,
		createIfMissing: boolean = false,
	): Promise<string | null> {
		const existingIdentity = await this.identitiesRepository.findOne({
			where: { pluginId, identifierId, identity: identityValue },
			select: ["artistUuid"],
		});

		if (existingIdentity) {
			return existingIdentity.artistUuid;
		}

		if (!createIfMissing) {
			return null;
		}

		return await this.dataSource.transaction(async (manager) => {
			const newArtist = manager.create(DBArtist);
			const savedArtist = await manager.save(newArtist);

			const newIdentity = manager.create(DBArtistIdentity, {
				artistUuid: savedArtist.uuid,
				pluginId,
				identifierId,
				identity: identityValue,
				target,
				ordinal: 0,
			});
			await manager.save(newIdentity);

			return savedArtist.uuid;
		});
	}

	async clearTrackLinks(
		track: DBTrack,
		pluginId: string,
		identifierId: string,
	) {
		await this.trackArtistsRepository.delete({
			trackUuid: track.uuid,
			pluginId,
			identifierId,
		});
	}

	async setTrackLinks(
		track: DBTrack,
		artistUuids: string[],
		pluginId: string,
		identifierId: string,
	) {
		await this.clearTrackLinks(track, pluginId, identifierId);
		await this.trackArtistsRepository.insert(
			artistUuids.map((artistUuid, ordinal) => ({
				trackUuid: track.uuid,
				artistUuid,
				pluginId,
				identifierId,
				ordinal,
			})),
		);
	}

	async findOne(
		uuid: string,
		options: {
			withAttributes?: boolean;
			withIdentities?: boolean;
			withTracks?: number | boolean;
			withTrackIdentities?: boolean;
			withTrackAttributes?: boolean;
			withTrackArtists?: boolean;
			withTrackArtistIdentities?: boolean;
			withTrackArtistAttributes?: boolean;
			withTrackAlbums?: boolean;
			withAlbums?: boolean;
			withAlbumTracks?: boolean;
			withAlbumTrackAttributes?: boolean;
			withAlbumTrackIdentities?: boolean;
			withAlbumIdentities?: boolean;
			withAlbumAttributes?: boolean;
			withAlbumArtists?: boolean;
			withAlbumArtistIdentities?: boolean;
			withAlbumArtistAttributes?: boolean;
		} = {},
	) {
		const artist = await this.artistsRepository.findOne({
			where: {
				uuid,
			},
			relationLoadStrategy: "query",
			relations: {
				attributes: options.withAttributes && {
					value_buffer: true,
				},
				identities: options.withIdentities,
			},
		});

		if (!artist) {
			return null;
		}

		if (options.withTracks) {
			const tracks = await this.trackManagerService.find({
				where: {
					artists: {
						artistUuid: artist.uuid,
					},
				},
				take:
					typeof options.withTracks == "number"
						? options.withTracks
						: undefined,
				select: ["uuid"],
			});

			const trackArtists = await this.trackArtistsRepository.find({
				where: {
					artistUuid: artist.uuid,
					trackUuid: In(tracks.map((track) => track.uuid)),
				},
				relations: {
					track: {
						attributes: options.withTrackAttributes,
						artists: options.withTrackArtists && {
							artist: {
								attributes: true,
							},
						},
						albums: options.withTrackAlbums && {
							album: {
								attributes: true,
							},
						},
					},
				},
			});

			const uniqueMap = new Map<string, DBTrackArtist>();

			for (const trackArtist of trackArtists) {
				if (!uniqueMap.has(trackArtist.trackUuid)) {
					uniqueMap.set(trackArtist.trackUuid, trackArtist);
				}
			}

			artist.tracks = Array.from(uniqueMap.values());
		}

		if (options.withAlbums) {
			artist.albums = await this.albumManagerService.findForArtist(artist, {
				withIdentities: options.withAlbumIdentities,
				withAttributes: options.withAlbumAttributes,
				withArtists: options.withAlbumArtists,
				withArtistIdentities: options.withAlbumArtistIdentities,
				withArtistAttributes: options.withAlbumArtistAttributes,
				withTracks: options.withAlbumTracks,
				withTrackIdentities: options.withAlbumTrackIdentities,
				withTrackAttributes: options.withAlbumTrackAttributes,
			});
		}

		return artist;
	}

	findIdentities(artist: DBArtist | string) {
		return this.identitiesRepository.findBy({
			artistUuid: typeof artist == "string" ? artist : artist.uuid,
		});
	}

	findMany(options: {
		amount: number;
		offset?: number;
		withAttributes?: boolean;
		withIdentities?: boolean;
	}) {
		return this.artistsRepository.find({
			take: options.amount,
			skip: options.offset,
			relationLoadStrategy: "query",
			relations: {
				attributes: options.withAttributes,
				identities: options.withIdentities,
			},
		});
	}

	findManyRaw(options: FindManyOptions<DBArtist>) {
		return this.artistsRepository.find(options);
	}

	async updateAttributionRunId(runId: string, artistUuids: string[]) {
		await this.artistsRepository.update(
			{
				uuid: In(artistUuids),
			},
			{
				lastAttributionRunId: runId,
			},
		);
	}

	count(where: FindOptionsWhere<DBArtist> | FindOptionsWhere<DBArtist>[]) {
		return this.artistsRepository.countBy(where);
	}

	public registerIdentifier(
		identifier: ArtistIdentifier,
		plugin: LoadedPlugin,
	) {
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

	public async getInformationHelper(
		artist: DBArtist,
		getIdentities?: (id: string, pluginId?: string | null) => Identity[] | null,
	): Promise<ArtistInformationHelper> {
		if (!getIdentities) {
			const identities = await this.findIdentities(artist);

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
			getArtistUuid: () => artist.uuid,
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

	public async identifyArtist(
		artist: DBArtist,
		runId: string,
	): Promise<ArtistIdentificationResult> {
		let allIdentities = await this.findIdentities(artist);

		const newEntries: DBArtistIdentity[] = [];

		if (!this.orderedIdentifiers.length) {
			this.logger.warn(
				`Cannot identify Artist "${artist.uuid}" because no identifiers are registered`,
			);
			return { identities: [], mergedArtists: [artist.uuid] };
		}

		// 1. RUN IDENTIFIERS (Standard logic)
		for (const { identifier, plugin } of this.orderedIdentifiers) {
			const helper = await this.getInformationHelper(artist, (id, pluginId) =>
				allIdentities
					.map((i) => i.toIdentity())
					.filter(
						(i) => i.identityId == id && (!pluginId || i.pluginId == pluginId),
					),
			);
			const newIdentities = await identifier.identify(
				helper,
				new Logger(`PLUGIN ${plugin.package.name}`),
			);

			allIdentities = allIdentities.filter(
				(i) =>
					i.identifierId != identifier.id ||
					i.pluginId != plugin.package.name ||
					i.target != ArtistIdentityTarget.ARTIST,
			);

			if (newIdentities?.length) {
				for (const [ordinal, identity] of newIdentities.entries()) {
					const newIdentity = this.identitiesRepository.create({
						artistUuid: artist.uuid,
						pluginId: plugin.package.name,
						identifierId: identifier.id,
						identity,
						target: ArtistIdentityTarget.ARTIST,
						ordinal,
					});

					allIdentities.push(newIdentity);
					newEntries.push(newIdentity);
				}
			}
		}

		if (!newEntries.length) {
			await this.artistsRepository.update(
				{ uuid: artist.uuid },
				{ lastIdentificationRunId: runId },
			);
			return { identities: [], mergedArtists: [artist.uuid] };
		}

		// 2. FIND MERGE CANDIDATES
		const matchConditions = newEntries.map((e) => ({
			pluginId: e.pluginId,
			identifierId: e.identifierId,
			identity: e.identity,
		}));

		const existingArtistIdentities = await this.identitiesRepository.find({
			where: matchConditions,
			relations: { artist: true },
		});

		const existingArtistMap = new Map<string, DBArtist>();
		existingArtistMap.set(artist.uuid, artist); // Crucial: include self

		for (const identity of existingArtistIdentities) {
			if (identity.artist)
				existingArtistMap.set(identity.artist.uuid, identity.artist);
		}

		const existingArtists = Array.from(existingArtistMap.values());

		// 3. TRANSACTIONAL MERGE
		return this.dataSource.transaction<ArtistIdentificationResult>(
			async (tm) => {
				const artistsRepo = tm.getRepository(DBArtist);
				const idRepo = tm.getRepository(DBArtistIdentity);
				const trackArtistsRepo = tm.getRepository(DBTrackArtist);
				const attrRepo = tm.getRepository(DBArtistAttribute);

				if (existingArtists.length > 1) {
					existingArtists.sort((a, b) => a.dateAdded - b.dateAdded);
					const masterArtist = existingArtists[0]!;
					const allArtistIds = existingArtists.map((a) => a.uuid);
					const removedArtistIds = allArtistIds.slice(1);

					// --- A. MERGE IDENTITIES ---
					const currentIds = await idRepo.findBy({
						artistUuid: In(allArtistIds),
					});
					const masterIdentities: DBArtistIdentity[] = [];
					const idOrdinalMap: Record<string, number> = {};

					const addIdentity = (data: Partial<DBArtistIdentity>) => {
						const valKey = `${data.pluginId}:${data.identifierId}:${data.identity}`;
						if (
							masterIdentities.some(
								(i) =>
									`${i.pluginId}:${i.identifierId}:${i.identity}` === valKey,
							)
						)
							return;

						const ordKey = `${data.pluginId}:${data.identifierId}`;
						const ordinal = idOrdinalMap[ordKey] || 0;
						idOrdinalMap[ordKey] = ordinal + 1;

						masterIdentities.push(
							idRepo.create({
								...data,
								artistUuid: masterArtist.uuid,
								ordinal,
							}),
						);
					};

					newEntries.forEach(addIdentity);
					currentIds.forEach(addIdentity);

					await idRepo.delete({ artistUuid: In(allArtistIds) });
					await idRepo.insert(masterIdentities);

					// --- B. MERGE ATTRIBUTES (Prevent Identical-Value Duplicates) ---
					const allAttrs = await attrRepo.find({
						where: { entityId: In(allArtistIds) },
					});
					const masterAttributes: DBArtistAttribute[] = [];
					const attrOrdinalMap: Record<string, number> = {};

					for (const attr of allAttrs) {
						// Check if an attribute with the same plugin, source, key, and VALUE already exists
						const isDuplicateValue = masterAttributes.some(
							(ma) =>
								ma.pluginId === attr.pluginId &&
								ma.sourceId === attr.sourceId &&
								ma.key === attr.key &&
								((ma.value_boolean !== null &&
									ma.value_boolean === attr.value_boolean) ||
									(ma.value_decimal !== null &&
										ma.value_decimal === attr.value_decimal) ||
									(ma.value_int !== null && ma.value_int === attr.value_int) ||
									(ma.value_string !== null &&
										ma.value_string === attr.value_string) ||
									(ma.value_buffer !== null &&
										ma.value_buffer.uuid === attr.value_buffer?.uuid)),
						);

						if (isDuplicateValue) continue;

						// Re-calculate ordinal to avoid SQLITE_CONSTRAINT
						const ordKey = `${attr.pluginId}:${attr.sourceId}:${attr.key}`;
						const ordinal = attrOrdinalMap[ordKey] || 0;
						attrOrdinalMap[ordKey] = ordinal + 1;

						masterAttributes.push(
							attrRepo.create({
								...attr,
								entityId: masterArtist.uuid,
								entityRelationId: masterArtist.uuid,
								ordinal,
							}),
						);
					}

					await attrRepo.delete({ entityId: In(allArtistIds) });
					if (masterAttributes.length) await attrRepo.insert(masterAttributes);

					// --- C. MERGE TRACK LINKS (Preserve Cross-Plugin Links) ---
					const allLinks = await trackArtistsRepo.findBy({
						artistUuid: In(allArtistIds),
					});
					const uniqueLinks: Record<string, DBTrackArtist> = {};

					for (const link of allLinks) {
						// Key by track + plugin + identifier to allow multiple plugins per track
						const compositeKey = `${link.trackUuid}:${link.pluginId}:${link.identifierId}`;

						if (!uniqueLinks[compositeKey]) {
							uniqueLinks[compositeKey] = trackArtistsRepo.create({
								...link,
								artistUuid: masterArtist.uuid,
							});
						}
					}

					await trackArtistsRepo.delete({ artistUuid: In(allArtistIds) });
					await trackArtistsRepo.insert(Object.values(uniqueLinks));

					// --- D. CLEANUP ---
					await artistsRepo.delete({ uuid: In(removedArtistIds) });
					await artistsRepo.update(masterArtist.uuid, {
						lastIdentificationRunId: runId,
					});

					return { mergedArtists: allArtistIds, identities: masterIdentities };
				} else {
					// Standard single-artist update
					await artistsRepo.update(artist.uuid, {
						lastIdentificationRunId: runId,
					});
					await idRepo.delete(
						newEntries.map((e) => ({
							artistUuid: artist.uuid,
							pluginId: e.pluginId,
							identifierId: e.identifierId,
						})),
					);
					await idRepo.insert(newEntries);
					return { mergedArtists: [artist.uuid], identities: newEntries };
				}
			},
		);
	}

	public async getExternalUrls(artist: DBArtist) {
		return this.externalUrlsService.getArtistUrls(
			await this.getInformationHelper(artist),
		);
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

		if (!identifiers.length) {
			await this.identitiesRepository.deleteAll();
			return;
		}

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

		await this.identitiesRepository
			.createQueryBuilder()
			.delete()
			.from(DBArtistIdentity)
			.where(`NOT (${conditionStrings.join(" OR ")})`, queryParameters)
			.execute();

		await this.trackArtistsRepository
			.createQueryBuilder()
			.delete()
			.from(DBTrackArtist)
			.where(`NOT (${conditionStrings.join(" OR ")})`, queryParameters)
			.execute();
	}

	async removeOrphanedArtists() {
		const subQueryBuilder = this.artistsRepository.manager.createQueryBuilder();

		const artistsWithTracks = subQueryBuilder
			.subQuery()
			.select('track."artistUuid"')
			.from(DBTrackArtist, "track")
			.where('track."artistUuid" IS NOT NULL')
			.getQuery();

		const artistsWithAlbums = subQueryBuilder
			.subQuery()
			.select('album."artistUuid"')
			.from(DBAlbumArtist, "album")
			.where('album."artistUuid" IS NOT NULL')
			.getQuery();

		await this.artistsRepository
			.createQueryBuilder()
			.delete()
			.from(DBArtist)
			.where(`uuid NOT IN ${artistsWithTracks}`)
			.andWhere(`uuid NOT IN ${artistsWithAlbums}`)
			.execute();
	}

	public async forEachArtist(
		callback: (artistUuid: string, cancel: () => void) => void | Promise<void>,
	) {
		const CHUNK_SIZE = 1_000;

		let isCancelled = false;

		for (let i = 0; true; i++) {
			if (isCancelled) {
				return;
			}
			const artists = await this.findMany({
				amount: CHUNK_SIZE,
				offset: CHUNK_SIZE * i,
			});
			if (!artists.length || isCancelled) {
				break;
			}
			for (const artist of artists) {
				await callback(artist.uuid, () => {
					isCancelled = true;
				});
				if (isCancelled) {
					return;
				}
			}
		}
	}
}
