import { Injectable, Logger } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import {
	AlbumIdentifier,
	AlbumInformationHelper,
	Identity,
	TrackIdentifier,
} from "@sdk";
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
import {
	DataSource,
	DeepPartial,
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
	}) {
		return this.albumsRepository.find({
			where: options.where,
			take: options.amount,
			skip: options.offset,
			relationLoadStrategy: "query",
			relations: {
				attributes: options.withAttributes,
				identities: options.withIdentities,
				artists: !!options.withArtists && {
					artist: {
						attributes: true,
					},
				},
			},
		});
	}

	async findForArtist(
		artist: DBArtist,
		options: {
			amount: number;
			withAttributes?: boolean;
			withArtists?: boolean;
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

		const albumArtists = await this.albumArtistsRepository.find({
			where: {
				artistUuid: artist.uuid,
				albumUuid: In(albums.map((album) => album.uuid)),
			},
			relations: {
				album: {
					attributes: options.withAttributes,
					artists: options.withArtists && {
						artist: {
							attributes: true,
						},
					},
				},
			},
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
			withTracks?: boolean;
			withTrackAttributes?: boolean;
			withTrackArtists?: boolean;
		} = {},
	) {
		const album = await this.albumsRepository.findOne({
			where: {
				uuid,
			},
			relationLoadStrategy: "query",
			relations: {
				attributes: options.withAttributes,
				identities: options.withIdentities,
				artists: !!options.withArtists && {
					artist: {
						attributes: true,
					},
				},
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
			},
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
		return await this.dataSource.transaction(async (tm) => {
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
			});

			return saved.uuid;
		});
	}

	public async setTrackLinks(
		track: DBTrack,
		albumUuids: string[],
		pluginId: string,
		identifierId: string,
		// Optional: Metadata sources often provide position
		position?: { disc: number; track: number },
	) {
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
	}

	public async clearTrackLinks(
		track: DBTrack,
		pluginId: string,
		identifierId: string,
	) {
		await this.albumTracksRepository.delete({
			trackUuid: track.uuid,
			pluginId,
			identifierId,
		});
	}

	async clearArtistLinks(
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

	async setArtistLinks(
		album: DBAlbum,
		artistUuids: string[],
		pluginId: string,
		identifierId: string,
	) {
		await this.clearArtistLinks(album, pluginId, identifierId);
		await this.albumArtistsRepository.insert(
			artistUuids.map((artistUuid, ordinal) => ({
				albumUuid: album.uuid,
				artistUuid,
				pluginId,
				identifierId,
				ordinal,
			})),
		);
	}

	async setJoinPhrase(
		albumUuid: string,
		artistUuid: string,
		joinPhrase: string | null,
	) {
		await this.albumArtistsRepository.update(
			{
				albumUuid,
				artistUuid,
			},
			{
				joinPhrase,
			},
		);
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
				return matches[0]! as any;
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
			.from(DBAlbumIdentity)
			.where(`NOT (${conditionStrings.join(" OR ")})`, queryParameters)
			.execute();

		await this.albumArtistsRepository
			.createQueryBuilder()
			.delete()
			.from(DBAlbumArtist)
			.where(`NOT (${conditionStrings.join(" OR ")})`, queryParameters)
			.execute();
	}

	async removeOrphanedAlbums() {
		const subQueryBuilder = this.albumsRepository.manager.createQueryBuilder();

		const albumsWithTracks = subQueryBuilder
			.subQuery()
			.select('track."albumUuid"')
			.from(DBAlbumTrack, "track")
			.where('track."albumUuid" IS NOT NULL')
			.getQuery();

		await this.albumsRepository
			.createQueryBuilder()
			.delete()
			.from(DBAlbum)
			.where(`uuid NOT IN ${albumsWithTracks}`)
			.execute();
	}
}
