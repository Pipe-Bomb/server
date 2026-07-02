import { Injectable, Logger } from "@nestjs/common";
import { TrackAttributionHelper } from "@sdk";
import { DBTrack } from "src/tracks/entities/track.entity";
import { DBAttributeTemplate } from "./entities/attribute.entity-template";
import { DBTrackAttribute } from "./entities/track-attribute.entity";
import { PersistentAttributeResponse } from "./response/persistent-attribute.response";
import { TasksService } from "src/tasks/tasks.service";
import { DBArtistAttribute } from "./entities/artist-attribute.entity";
import { LoadedLibraryHandler } from "src/libraries/interface/loaded-library.interface";
import { DBArtist } from "src/artist-manager/entity/artist.entity";
import { AttributeSourcesService } from "src/attribute-sources/attribute-sources.service";
import { DBAlbum } from "src/albums/entity/album.entity";
import { DBAlbumAttribute } from "./entities/album-attribute.entity";
import { ArtistIdentityTarget } from "src/artist-manager/enum/artist-identity-target.enum";
import { AlbumManagerService } from "src/album-manager/album-manager.service";
import { ArtistManagerService } from "src/artist-manager/artist-manager.service";
import { FindOptionsWhere, In, IsNull, Not } from "typeorm";

@Injectable()
export class AttributesService {
	private readonly logger = new Logger("Attributes Service");

	constructor(
		private readonly attributeSourcesService: AttributeSourcesService,
		private readonly tasksService: TasksService,
		private readonly artistManagerService: ArtistManagerService,
		private readonly albumManagerService: AlbumManagerService,
	) {
		this.tasksService.registerSystemTask<"all" | "new">({
			id: "attribute-artists",
			resumable: false,
			getSubTasks: () => ["all", "new"],
			run: async (context, subTaskId) => {
				await this.attributeAllArtists(
					context.getRunId(),
					subTaskId == "new",
					(completed, total) => context.update(completed / total),
				);
			},
		});

		this.tasksService.registerSystemTask<"all" | "new">({
			id: "attribute-albums",
			resumable: false,
			getSubTasks: () => ["all", "new"],
			run: async (context, subTaskId) => {
				await this.attributeAllAlbums(
					context.getRunId(),
					subTaskId == "new",
					(completed, total) => context.update(completed / total),
				);
			},
		});
	}

	async attributeTrack(
		track: DBTrack,
		library: LoadedLibraryHandler,
	): Promise<DBTrackAttribute[]> {
		const allTrackAttributes: DBTrackAttribute[] = [];
		const allArtistAttributes: DBArtistAttribute[] = [];

		const completedAttributes = new Set<string>();

		const sources = this.attributeSourcesService.getSources();

		for (const source of sources) {
			const attributionHelper: TrackAttributionHelper = {
				...(await library.informationHelper(track)),
				getCompletedAttributeKeys: () => Array.from(completedAttributes),
			};

			const trackMeta =
				await source.source.getTrackAttributeValues(attributionHelper);

			const dbAttributes =
				await this.attributeSourcesService.createTrackAttributes(
					track.uuid,
					trackMeta.attributes ?? [],
					source,
				);

			for (const dbAttribute of dbAttributes) {
				allTrackAttributes.push(dbAttribute);
				completedAttributes.add(dbAttribute.key);
			}

			if (trackMeta.artists?.length) {
				for (const artist of trackMeta.artists) {
					const artistUuid = await this.artistManagerService.resolveArtist(
						artist.pluginId,
						artist.identityId,
						artist.identity,
						ArtistIdentityTarget.TRACK,
					);
					if (!artistUuid) {
						this.logger.warn(
							`Attribute Source "${source.source.id}" from Plugin "${source.plugin.package.name}" attempted to resolve artist that didn't exist`,
						);
						continue;
					}

					allArtistAttributes.push(
						...(await this.attributeSourcesService.createArtistAttributes(
							artistUuid,
							artist.attributes ?? [],
							source,
						)),
					);

					if (artist.joinPhrase) {
						await this.artistManagerService.setJoinPhrase(
							track.uuid,
							artistUuid,
							artist.joinPhrase,
						);
					}
				}
			}
		}

		await this.attributeSourcesService.upsertTrackAttributes(
			allTrackAttributes,
		);
		await this.attributeSourcesService.upsertArtistAttributes(
			allArtistAttributes,
		);
		return allTrackAttributes;
	}

	async attributeArtist(artist: DBArtist) {
		const allAttributes: DBArtistAttribute[] = [];

		const helper = await this.artistManagerService.getInformationHelper(artist);
		const sources = this.attributeSourcesService.getSources();

		for (const source of sources) {
			try {
				const artistMeta = await source.source.getArtistAttributeValues(helper);
				const dbAttributes =
					await this.attributeSourcesService.createArtistAttributes(
						artist.uuid,
						artistMeta.attributes ?? [],
						source,
					);
				allAttributes.push(...dbAttributes);
			} catch (e) {
				this.logger.error(
					`Attribute Source "${source.source.getName()}" from Plugin "${source.plugin.package.name}" failed to attribute Artist "${artist.uuid}":`,
					e,
				);
			}
		}

		await this.attributeSourcesService.replaceAllArtistAttributes(
			artist.uuid,
			allAttributes,
		);
	}

	async attributeAllArtists(
		runId: string,
		onlyNew: boolean,
		onProgress?: (completed: number, total: number) => void,
	) {
		const CHUNK_SIZE = 100;
		const failedUuids: string[] = [];

		const criteria: FindOptionsWhere<DBArtist>[] = [
			{
				lastAttributionRunId: IsNull(),
				uuid: Not(In(failedUuids)),
			},
		];

		if (!onlyNew) {
			criteria.push({
				lastIdentificationRunId: Not(runId),
				uuid: Not(In(failedUuids)),
			});
		}

		const count = await this.artistManagerService.count(criteria);
		if (!count) {
			return;
		}

		onProgress?.(0, count);

		let completed = 0;

		while (true) {
			const chunk = await this.artistManagerService.findManyRaw({
				where: criteria,
				take: CHUNK_SIZE,
			});
			if (!chunk.length) {
				return false;
			}

			const results = await Promise.allSettled(
				chunk.map((artist) =>
					this.attributeArtist(artist).finally(() =>
						onProgress?.(++completed, count),
					),
				),
			);
			const successIds: string[] = [];

			for (const [index, result] of results.entries()) {
				const artist = chunk[index];

				if (result.status == "fulfilled") {
					successIds.push(artist.uuid);
				} else {
					failedUuids.push(artist.uuid);
				}
			}

			if (successIds.length) {
				await this.artistManagerService.updateAttributionRunId(
					runId,
					successIds,
				);
			}
		}
	}

	async attributeAllAlbums(
		runId: string,
		onlyNew: boolean,
		onProgress?: (completed: number, total: number) => void,
	) {
		const CHUNK_SIZE = 100;
		const failedUuids: string[] = [];

		const criteria: FindOptionsWhere<DBAlbum>[] = [
			{
				lastAttributionRunId: IsNull(),
				uuid: Not(In(failedUuids)),
			},
		];

		if (!onlyNew) {
			criteria.push({
				lastIdentificationRunId: Not(runId),
				uuid: Not(In(failedUuids)),
			});
		}

		const count = await this.albumManagerService.count(criteria);
		if (!count) {
			return;
		}

		onProgress?.(0, count);

		let completed = 0;

		while (true) {
			const chunk = await this.albumManagerService.findManyRaw({
				where: criteria,
				take: CHUNK_SIZE,
			});
			if (!chunk.length) {
				return false;
			}

			const results = await Promise.allSettled(
				chunk.map((album) =>
					this.attributeAlbum(album).finally(() =>
						onProgress?.(++completed, count),
					),
				),
			);
			const successIds: string[] = [];

			for (const [index, result] of results.entries()) {
				const album = chunk[index];

				if (result.status == "fulfilled") {
					successIds.push(album.uuid);
				} else {
					failedUuids.push(album.uuid);
				}
			}

			if (successIds.length) {
				await this.albumManagerService.updateAttributionRunId(
					runId,
					successIds,
				);
			}
		}
	}

	async attributeAlbum(album: DBAlbum) {
		const allAlbumAttributes: DBAlbumAttribute[] = [];
		const allArtistAttributes: DBArtistAttribute[] = [];

		const helper = await this.albumManagerService.getInformationHelper(album);
		const sources = this.attributeSourcesService.getSources();

		for (const source of sources) {
			try {
				const albumMeta = await source.source.getAlbumAttributeValues(helper);
				const dbAttributes =
					await this.attributeSourcesService.createAlbumAttributes(
						album.uuid,
						albumMeta.attributes ?? [],
						source,
					);
				allAlbumAttributes.push(...dbAttributes);

				if (albumMeta.artists?.length) {
					for (const artist of albumMeta.artists) {
						const artistUuid = await this.artistManagerService.resolveArtist(
							artist.pluginId,
							artist.identityId,
							artist.identity,
							ArtistIdentityTarget.ALBUM,
						);
						if (!artistUuid) {
							this.logger.warn(
								`Attribute Source "${source.source.id}" from Plugin "${source.plugin.package.name}" attempted to resolve album that didn't exist`,
							);
							continue;
						}

						allArtistAttributes.push(
							...(await this.attributeSourcesService.createArtistAttributes(
								artistUuid,
								artist.attributes ?? [],
								source,
							)),
						);

						if (artist.joinPhrase) {
							await this.albumManagerService.setJoinPhrase(
								album.uuid,
								artistUuid,
								artist.joinPhrase,
							);
						}
					}
				}
			} catch (e) {
				this.logger.error(
					`Attribute Source "${source.source.getName()}" from Plugin "${source.plugin.package.name}" failed to attribute Album "${album.uuid}":`,
					e,
				);
			}
		}

		await this.attributeSourcesService.replaceAllAlbumAttributes(
			album.uuid,
			allAlbumAttributes,
		);
		await this.attributeSourcesService.upsertArtistAttributes(
			allArtistAttributes,
		);
		return allAlbumAttributes;
	}

	// findTrackAttributes(tracks: DBTrack[]) {
	// 	return this.findAttributes(
	// 		this.trackAttributesRepository,
	// 		tracks.map((track) => track.uuid),
	// 	);
	// }

	// private async findAttributes(
	// 	repository: Repository<DBTrackAttribute>,
	// 	entityIds: string[],
	// ) {
	// 	// todo: support ordering attribute sources

	// 	if (!entityIds.length) {
	// 		return [];
	// 	}

	// 	const rawAttributes = await repository.findBy({
	// 		entityId: entityIds.length == 1 ? entityIds[0] : In(entityIds),
	// 	});

	// 	return entityIds.map((entityId) => ({
	// 		entityId,
	// 		attributes: rawAttributes.filter(
	// 			(attribute) => attribute.entityId == entityId,
	// 		),
	// 	}));
	// }

	toSimplifiedAttributeList(attributes: DBAttributeTemplate[]) {
		const dictionary: Record<string, PersistentAttributeResponse[]> = {};

		for (const attribute of attributes) {
			if (attribute.key in dictionary) {
				dictionary[attribute.key].push(attribute.toResponse());
			} else {
				dictionary[attribute.key] = [attribute.toResponse()];
			}
		}

		const output: Record<string, PersistentAttributeResponse> = {};
		for (const [key, list] of Object.entries(dictionary)) {
			const first = list.shift()!;
			const type = first.type;
			if (list.some((attribute) => attribute.type != type)) {
				throw new Error(
					`Attribute list contains multiple values of key "${key}" with different types`,
				);
			}

			for (const entry of list) {
				(first.values as any[]).push(...entry.values);
			}
			output[key] = first;
		}

		return output;
	}
}
