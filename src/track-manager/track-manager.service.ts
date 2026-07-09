import { BadRequestException, Injectable, Logger } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { LibraryHandler, Track } from "@sdk";
import { DBAlbumTrack } from "src/albums/entity/album-track.entity";
import { DBTrackArtist } from "src/artist-manager/entity/track-artist.entity";
import { AttributeEntity } from "src/attribute-sources/enum/attribute-entity.enum";
import { DBAlbumAttribute } from "src/attributes/entities/album-attribute.entity";
import { DBArtistAttribute } from "src/attributes/entities/artist-attribute.entity";
import { DBTrackAttribute } from "src/attributes/entities/track-attribute.entity";
import { AttributeType } from "src/attributes/enum/attribute-type.enum";
import { DBSmartPlaylistFilterGroup } from "src/playlists/entity/smart-playlist-filter-group.entity";
import { LoadedPlugin } from "src/plugins/interface/loaded-plugin.interface";
import { DBTrack } from "src/tracks/entities/track.entity";
import { WorkflowsService } from "src/workflows/workflows.service";
import {
	Repository,
	FindManyOptions,
	FindOptionsWhere,
	FindOneOptions,
	In,
	QueryDeepPartialEntity,
} from "typeorm";

@Injectable()
export class TrackManagerService {
	private readonly logger = new Logger("Track Manager Service");
	private readonly addTrackListeners = new Set<() => void>();

	constructor(
		@InjectRepository(DBTrack)
		private readonly tracksRepository: Repository<DBTrack>,
		private readonly workflowsService: WorkflowsService,
	) {
		this.workflowsService.registerStep(
			{
				type: "trigger",
				id: "new-tracks",
				getOptions: () => [],
				create: (ctx) => {
					const listener = () => ctx.activate(true);
					this.addTrackListeners.add(listener);

					return () => {
						this.addTrackListeners.delete(listener);
					};
				},
			},
			null,
		);
	}

	queryBuilder(alias?: string) {
		return this.tracksRepository.createQueryBuilder(alias);
	}

	find(options: FindManyOptions<DBTrack>) {
		return this.tracksRepository.find(options);
	}

	count(where: FindOptionsWhere<DBTrack> | FindOptionsWhere<DBTrack>[]) {
		return this.tracksRepository.countBy(where);
	}

	findOne(options: FindOneOptions<DBTrack>) {
		return this.tracksRepository.findOne(options);
	}

	async deleteAll() {
		await this.tracksRepository.deleteAll();
	}

	async setRunId(
		tracks: DBTrack[],
		runId: string,
		type: "attribute" | "identity",
	) {
		const partial: QueryDeepPartialEntity<DBTrack> = (() => {
			switch (type) {
				case "attribute":
					return {
						lastAttributionRunId: runId,
					};
				case "identity":
					return {
						lastIdentificationRunId: runId,
					};
			}
		})();

		await this.tracksRepository.update(
			{
				uuid: In(tracks.map((track) => track.uuid)),
			},
			partial,
		);
	}

	async addTrack(
		plugin: LoadedPlugin,
		libraryHandler: LibraryHandler,
		track: Track,
		runId: string | null,
	) {
		if (runId) {
			await this.tracksRepository.upsert(
				{
					pluginId: plugin.package.name,
					libraryId: libraryHandler.id,
					trackId: track.id,
					title: track.title,
					lastScanRunId: runId,
				},
				{
					conflictPaths: ["pluginId", "libraryId", "trackId"],
					skipUpdateIfNoValuesChanged: true,
				},
			);
		} else {
			await this.tracksRepository.upsert(
				{
					pluginId: plugin.package.name,
					libraryId: libraryHandler.id,
					trackId: track.id,
					title: track.title,
					lastScanRunId: null,
				},
				["pluginId", "libraryId", "trackId"],
			);
		}

		for (const listener of this.addTrackListeners) {
			listener();
		}
	}

	async removeTracks(
		plugin: LoadedPlugin,
		libraryHandler: LibraryHandler,
		trackIds: string[],
	) {
		const chunks: string[][] = [];
		for (let i = 0; i * 1000 < trackIds.length; i++) {
			chunks.push(trackIds.slice(i * 1000, (i + 1) * 1000));
		}

		for (const chunk of chunks) {
			await this.tracksRepository.delete({
				pluginId: plugin.package.name,
				libraryId: libraryHandler.id,
				trackId: In(chunk),
			});
		}
	}

	async addTracks(
		plugin: LoadedPlugin,
		libraryHandler: LibraryHandler,
		tracks: Track[],
	) {
		const ids = tracks.map((track) => track.id);
		const output: (DBTrack | null)[] = Array(tracks.length).fill(null);

		const existingTracks = await this.tracksRepository.find({
			where: {
				pluginId: plugin.package.name,
				libraryId: libraryHandler.id,
				trackId: In(ids),
			},
		});
		const existingIds = existingTracks.map((track) => track.trackId);
		for (const track of existingTracks) {
			const index = ids.indexOf(track.trackId);
			if (index < 0) {
				throw new Error("Invalid track returned");
			}
			output[index] = track;
		}

		const toInsert = this.tracksRepository.create(
			tracks
				.filter((track) => !existingIds.includes(track.id))
				.map((track) => ({
					pluginId: plugin.package.name,
					libraryId: libraryHandler.id,
					trackId: track.id,
					title: track.title,
				})),
		);

		if (toInsert.length) {
			for (const track of toInsert) {
				const index = ids.indexOf(track.trackId);
				if (index < 0) {
					throw new Error("Invalid track created");
				}
				output[index] = track;
			}
			await this.tracksRepository.insert(toInsert);
			this.logger.debug(
				`Added ${toInsert.length} new Tracks to Library "${libraryHandler.id}" for Plugin "${plugin.package.name}"`,
			);
		}

		return output as DBTrack[];
	}

	async findTracksBySmartFilters(
		groups: DBSmartPlaylistFilterGroup[],
		amount?: number,
	): Promise<string[]> {
		const mainQb = this.tracksRepository.createQueryBuilder("track");
		mainQb.select("track.uuid", "id");

		const groupConditions: string[] = [];

		for (const [groupIndex, group] of groups.entries()) {
			const filterConditions: string[] = [];

			if (!group.filters || group.filters.length === 0) {
				continue;
			}

			for (const [filterIndex, filter] of group.filters.entries()) {
				const subQb = mainQb.subQuery().select("1");

				const alias = `attr_g${groupIndex}_f${filterIndex}`;
				const paramPrefix = `p_g${groupIndex}_f${filterIndex}`;
				const junctionAlias = `j_g${groupIndex}_f${filterIndex}`;

				switch (filter.entityType) {
					case AttributeEntity.TRACK:
						subQb
							.from(DBTrackAttribute, alias)
							.where(`${alias}.entityRelationId = track.uuid`);
						break;

					case AttributeEntity.ALBUM:
						subQb
							.from(DBAlbumTrack, junctionAlias)
							.innerJoin(
								DBAlbumAttribute,
								alias,
								`${alias}.entityRelationId = ${junctionAlias}.albumUuid`,
							)
							.where(`${junctionAlias}.trackUuid = track.uuid`);
						break;

					case AttributeEntity.ARTIST:
						subQb
							.from(DBTrackArtist, junctionAlias)
							.innerJoin(
								DBArtistAttribute,
								alias,
								`${alias}.entityRelationId = ${junctionAlias}.artistUuid`,
							)
							.where(`${junctionAlias}.trackUuid = track.uuid`);
						break;

					default:
						throw new BadRequestException(
							`Unsupported entity type: ${filter.entityType}`,
						);
				}

				subQb.andWhere(`${alias}.key = :${paramPrefix}_key`);
				mainQb.setParameter(`${paramPrefix}_key`, filter.attributeKey);

				switch (filter.attributeType) {
					case AttributeType.STRING: {
						if (filter.value_string !== null) {
							if (filter.partial) {
								subQb.andWhere(
									`${alias}.value_string LIKE :${paramPrefix}_string`,
								);
								mainQb.setParameter(
									`${paramPrefix}_string`,
									`%${filter.value_string}%`,
								);
							} else {
								subQb.andWhere(
									`${alias}.value_string = :${paramPrefix}_string`,
								);
								mainQb.setParameter(
									`${paramPrefix}_string`,
									filter.value_string,
								);
							}
						}
						break;
					}
					case AttributeType.BOOLEAN: {
						if (filter.value_boolean !== null) {
							subQb.andWhere(
								`${alias}.value_boolean = :${paramPrefix}_boolean`,
							);
							mainQb.setParameter(
								`${paramPrefix}_boolean`,
								filter.value_boolean,
							);
						}
						break;
					}
					case AttributeType.INTEGER: {
						if (filter.value_int !== null) {
							subQb.andWhere(`${alias}.value_int = :${paramPrefix}_int`);
							mainQb.setParameter(`${paramPrefix}_int`, filter.value_int);
						} else {
							if (filter.min !== null) {
								subQb.andWhere(`${alias}.value_int >= :${paramPrefix}_intMin`);
								mainQb.setParameter(`${paramPrefix}_intMin`, filter.min);
							}
							if (filter.max !== null) {
								subQb.andWhere(`${alias}.value_int <= :${paramPrefix}_intMax`);
								mainQb.setParameter(`${paramPrefix}_intMax`, filter.max);
							}
						}
						break;
					}
					case AttributeType.DECIMAL: {
						if (filter.value_decimal !== null) {
							subQb.andWhere(
								`${alias}.value_decimal = :${paramPrefix}_decimal`,
							);
							mainQb.setParameter(
								`${paramPrefix}_decimal`,
								filter.value_decimal,
							);
						} else {
							if (filter.min !== null) {
								subQb.andWhere(
									`${alias}.value_decimal >= :${paramPrefix}_decimalMin`,
								);
								mainQb.setParameter(`${paramPrefix}_decimalMin`, filter.min);
							}
							if (filter.max !== null) {
								subQb.andWhere(
									`${alias}.value_decimal <= :${paramPrefix}_decimalMax`,
								);
								mainQb.setParameter(`${paramPrefix}_decimalMax`, filter.max);
							}
						}
						break;
					}
					case AttributeType.BUFFER:
						break;
				}

				const operator = filter.inverse ? "NOT EXISTS" : "EXISTS";
				filterConditions.push(`${operator} ${subQb.getQuery()}`);
			}

			if (filterConditions.length > 0) {
				groupConditions.push(`(${filterConditions.join(" AND ")})`);
			}
		}

		if (groupConditions.length > 0) {
			mainQb.andWhere(`(${groupConditions.join(" OR ")})`);
		} else {
			return [];
		}

		if (amount) {
			mainQb.limit(amount);
		}

		const results = (await mainQb.getRawMany()) as { id: string }[];
		return results.map(({ id }) => id);
	}
}
