import { Injectable, Logger } from "@nestjs/common";
import { TrackAttributionHelper } from "@sdk";
import { LoadedAttributeSource } from "./interface/loaded-attribute-source.interface";
import { DBTrack } from "src/tracks/entities/track.entity";
import { In, Repository } from "typeorm";
import { DBAttributeTemplate } from "./entities/attribute.entity-template";
import { DBTrackAttribute } from "./entities/track-attribute.entity";
import { PersistentAttributeResponse } from "./response/persistent-attribute.response";
import { TasksService } from "src/tasks/tasks.service";
import { AttributeSourceResponse } from "./response/attribute-source.response";
import { DBArtistAttribute } from "./entities/artist-attribute.entity";
import { LoadedLibraryHandler } from "src/libraries/interface/loaded-library.interface";
import { ArtistsService } from "src/artists/artists.service";
import { ResourcesService } from "src/resources/resources.service";
import { DBArtist } from "src/artists/entity/artist.entity";
import { AttributeSourcesService } from "src/attribute-sources/attribute-sources.service";

@Injectable()
export class AttributesService {
	private readonly logger = new Logger("Attributes Service");

	private readonly sources: LoadedAttributeSource[] = [];

	constructor(
		private readonly attributeSourcesService: AttributeSourcesService,
		private readonly tasksService: TasksService,
		private readonly artistsService: ArtistsService,
	) {
		this.tasksService.registerSystemTask({
			id: "attribute-all-artists",
			run: async (context) => {
				await this.attributeAllArtists((completed, total) =>
					context.update(completed / total),
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

		for (const source of this.sources) {
			const attributionHelper: TrackAttributionHelper = {
				...(await library.informationHelper(track)),
				getCompletedAttributeKeys: () => Array.from(completedAttributes),
			};

			const attributes =
				await source.source.getTrackAttributeValues(attributionHelper);

			const dbAttributes =
				await this.attributeSourcesService.createTrackAttributes(
					track.uuid,
					attributes.track ?? [],
					source,
				);

			for (const dbAttribute of dbAttributes) {
				allTrackAttributes.push(dbAttribute);
				completedAttributes.add(dbAttribute.key);
			}

			if (attributes.artists?.length) {
				for (const artist of attributes.artists) {
					const artistUuid = await this.artistsService.resolveArtist(
						artist.pluginId,
						artist.identifierId,
						artist.identifierValue,
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
							artist.attributes,
							source,
						)),
					);

					if (artist.joinPhrase) {
						await this.artistsService.setJoinPhrase(
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
		await this.attributeSourcesService.upsertArtistAttribtues(
			allArtistAttributes,
		);
		return allTrackAttributes;
	}

	async attributeArtist(artist: DBArtist) {
		const allAttributes: DBArtistAttribute[] = [];

		const helper = await this.artistsService.getInformationHelper(artist);

		for (const source of this.sources) {
			try {
				const attributes = await source.source.getArtistAttributeValues(helper);
				const dbAttributes =
					await this.attributeSourcesService.createArtistAttributes(
						artist.uuid,
						attributes,
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
		onProgress?: (completed: number, total: number) => void,
	) {
		const count = await this.artistsService.count({});
		onProgress?.(0, count);

		for (let i = 0; true; i++) {
			const artists = await this.artistsService.findMany({
				amount: 100,
				offset: 100 * i,
			});

			if (!artists.length) {
				return;
			}

			// todo: multithread
			for (const [index, artist] of artists.entries()) {
				await this.attributeArtist(artist);
				onProgress?.(i * 100 + index, count);
			}
		}
	}

	getSources() {
		return [...this.sources];
	}

	// findTrackAttributes(tracks: DBTrack[]) {
	// 	return this.findAttributes(
	// 		this.trackAttributesRepository,
	// 		tracks.map((track) => track.uuid),
	// 	);
	// }

	private async findAttributes(
		repository: Repository<DBTrackAttribute>,
		entityIds: string[],
	) {
		// todo: support ordering attribute sources

		if (!entityIds.length) {
			return [];
		}

		const rawAttributes = await repository.findBy({
			entityId: entityIds.length == 1 ? entityIds[0] : In(entityIds),
		});

		return entityIds.map((entityId) => ({
			entityId,
			attributes: rawAttributes.filter(
				(attribute) => attribute.entityId == entityId,
			),
		}));
	}

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
