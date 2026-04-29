import { Injectable, Logger } from "@nestjs/common";
import { AttributeSource, LibraryHandler } from "@sdk";
import { LoadedPlugin } from "src/plugins/interface/loaded-plugin.interface";
import { LoadedAttributeSource } from "./interface/loaded-attribute-source.interface";
import { Attribute, AttributeValue } from "sdk/attribute";
import { LoadedAttribute } from "./interface/loaded-attribute.interface";
import { DBTrack } from "src/tracks/entities/track.entity";
import { DeepPartial, In, Repository } from "typeorm";
import { DBAttributeTemplate } from "./entities/attribute.entity-template";
import { InjectRepository } from "@nestjs/typeorm";
import { DBTrackAttribute } from "./entities/track-attribute.entity";
import { PersistentAttributeResponse } from "./response/persistent-attribute.response";
import { TasksService } from "src/tasks/tasks.service";
import { AttributeSourceResponse } from "./response/attribute-source.response";
import { DBArtistAttribute } from "./entities/artist-attribute.entity";
import { LoadedLibraryHandler } from "src/libraries/interface/loaded-library.interface";
import { ArtistsService } from "src/artists/artists.service";
import { ResourcesService } from "src/resources/resources.service";

@Injectable()
export class AttributesService {
	private readonly logger = new Logger("Attributes Service");

	private readonly sources: LoadedAttributeSource[] = [];
	private readonly trackAttributes = new Set<LoadedAttribute>();
	private readonly artistAttributes = new Set<LoadedAttribute>();

	constructor(
		@InjectRepository(DBTrackAttribute)
		private readonly trackAttributesRepository: Repository<DBTrackAttribute>,
		@InjectRepository(DBArtistAttribute)
		private readonly artistAttributesRepository: Repository<DBArtistAttribute>,
		private readonly tasksService: TasksService,
		private readonly artistsService: ArtistsService,
		private readonly resourcesService: ResourcesService,
	) {}

	registerAttributeSource(plugin: LoadedPlugin, source: AttributeSource) {
		for (const existingSource of this.sources) {
			if (
				existingSource.plugin.package.name == plugin.package.name &&
				existingSource.source.id == source.id
			) {
				throw new Error(
					`Plugin "${plugin.package.name}" has already registered an Attribute Source with ID "${source.id}"`,
				);
			}
		}

		const loadedAttributeSource: LoadedAttributeSource = {
			plugin,
			source,
		};

		source.enable({
			registerTrackAttributes: (attributes) => {
				for (const attribute of attributes) {
					this.registerTrackAttribute(loadedAttributeSource, attribute);
				}
			},
			registerArtistAttributes: (attributes) => {
				for (const attribute of attributes) {
					this.registerArtistAttribute(loadedAttributeSource, attribute);
				}
			},
			registerPluginTask: (task) =>
				this.tasksService.registerPluginTask(task, plugin),
		});
		this.sources.push(loadedAttributeSource); // todo: do this preserving saved order
		this.logger.log(
			`Plugin "${plugin.package.name}" registered Attribute Source "${source.id}"`,
		);
	}

	private registerAttribute(
		source: LoadedAttributeSource,
		attribute: Attribute,
		set: Set<LoadedAttribute>,
		debugName: string,
	) {
		for (const loadedAttribute of set) {
			if (
				loadedAttribute.source.plugin.package.name ==
					source.plugin.package.name &&
				loadedAttribute.source.source.id == source.source.id &&
				loadedAttribute.attribute.key == attribute.key
			) {
				throw new Error(
					`Plugin "${source.plugin.package.name}"'s Attribute Source "${source.source.id}" has already registered a "${debugName}" Attribute with key "${attribute.key}"`,
				);
			}
		}

		this.logger.debug(
			`Plugin "${source.plugin.package.name}"'s Attribute Source "${source.source.id}" registered "${debugName}" Attribute "${attribute.key}" (${attribute.type})`,
		);

		set.add({
			attribute,
			source,
		});
	}

	private registerTrackAttribute(
		source: LoadedAttributeSource,
		attribute: Attribute,
	) {
		this.registerAttribute(source, attribute, this.trackAttributes, "track");
	}

	private registerArtistAttribute(
		source: LoadedAttributeSource,
		attribute: Attribute,
	) {
		this.registerAttribute(source, attribute, this.artistAttributes, "artist");
	}

	async attributeTrack(
		track: DBTrack,
		library: LoadedLibraryHandler,
	): Promise<DBTrackAttribute[]> {
		const allTrackAttributes: DBTrackAttribute[] = [];
		const allArtistAttributes: DBArtistAttribute[] = [];

		for (const source of this.sources) {
			const attributes = await source.source.getTrackAttributeValues(
				await library.informationHelper(track),
			);
			const possibleTrackAttributes = Array.from(
				this.trackAttributes.values(),
			).filter(
				(attribute) =>
					attribute.source.plugin.package.name == source.plugin.package.name &&
					attribute.source.source.id == source.source.id,
			);

			allTrackAttributes.push(
				...(await this.createDBAttributes(
					this.trackAttributesRepository,
					track.uuid,
					attributes.track ?? [],
					source,
					possibleTrackAttributes,
				)),
			);

			if (attributes.artists?.length) {
				const possibleArtistAttributes = Array.from(
					this.artistAttributes.values(),
				).filter(
					(attribute) =>
						attribute.source.plugin.package.name ==
							source.plugin.package.name &&
						attribute.source.source.id == source.source.id,
				);

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
						...(await this.createDBAttributes(
							this.artistAttributesRepository,
							artistUuid,
							artist.attributes,
							source,
							possibleArtistAttributes,
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

		await this.trackAttributesRepository.delete({
			entityId: track.uuid,
		});
		await this.trackAttributesRepository.insert(allTrackAttributes);
		await this.artistAttributesRepository.upsert(allArtistAttributes, {
			conflictPaths: ["pluginId", "entityId", "ordinal", "key"],
		});
		return allTrackAttributes;
	}

	private async createDBAttributes<T extends DBAttributeTemplate>(
		repository: Repository<T>,
		entityId: string,
		attributes: AttributeValue[],
		source: LoadedAttributeSource,
		possibleAttributes: LoadedAttribute[],
	): Promise<T[]> {
		const ordinalCount: Record<string, number> = {};
		const result: T[] = [];
		for (const attribute of attributes) {
			const attributeTemplate = possibleAttributes.find(
				(possibleAttribute) => possibleAttribute.attribute.key == attribute.key,
			);
			if (!attributeTemplate) {
				throw new Error(
					`Plugin "${source.plugin.package.name}" has not registered an Attribute with key "${attribute.key}"`,
				);
			}

			const dbAttribute = await (async () => {
				const entity = repository.create({
					entityId,
					pluginId: source.plugin.package.name,
					key: attribute.key,
				} as DeepPartial<T>);

				const attributeType = attributeTemplate.attribute.type;
				switch (attributeType) {
					case "boolean":
						if (typeof attribute.value != "boolean") {
							throw new Error(
								`Plugin "${source.plugin.package.name}"'s Attribute with key "${attribute.key}" is type boolean`,
							);
						}
						entity.value_boolean = attribute.value;
						break;
					case "string":
						if (typeof attribute.value != "string") {
							throw new Error(
								`Plugin "${source.plugin.package.name}"'s Attribute with key "${attribute.key}" is type string`,
							);
						}
						entity.value_string = attribute.value;
						break;
					case "decimal":
						if (typeof attribute.value != "number") {
							throw new Error(
								`Plugin "${source.plugin.package.name}"'s Attribute with key "${attribute.key}" is type decimal`,
							);
						}
						if (attribute.value == Infinity) {
							throw new Error(
								`Plugin "${source.plugin.package.name}"'s Attribute with key "${attribute.key}" doesn't support Infinity`,
							);
						}
						entity.value_decimal = attribute.value;
						break;
					case "integer":
						if (
							typeof attribute.value != "number" ||
							attribute.value % 1 !== 0
						) {
							throw new Error(
								`Plugin "${source.plugin.package.name}"'s Attribute with key "${attribute.key}" is type integer`,
							);
						}
						entity.value_int = attribute.value;
						break;
					case "buffer":
						if (
							typeof attribute.value != "object" ||
							!(
								"data" in attribute.value &&
								"extension" in attribute.value &&
								Buffer.isBuffer(attribute.value.data) &&
								typeof attribute.value.extension == "string"
							)
						) {
							throw new Error(
								`Plugin "${source.plugin.package.name}"'s Attribute with key "${attribute.key}" is type buffer`,
							);
						}
						entity.value_buffer = await this.resourcesService.create(
							attribute.value.data,
							attribute.value.extension,
						);
						break;
				}

				if (attribute.key in ordinalCount) {
					entity.ordinal = ordinalCount[attribute.key]++;
				} else {
					ordinalCount[attribute.key] = 1;
					entity.ordinal = 0;
				}
				return entity;
			})();
			result.push(dbAttribute);
		}

		return result;
	}

	getSources() {
		return [...this.sources];
	}

	findTrackAttributes(tracks: DBTrack[]) {
		return this.findAttributes(
			this.trackAttributesRepository,
			tracks.map((track) => track.uuid),
		);
	}

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

	toResponse(source: LoadedAttributeSource): AttributeSourceResponse {
		return {
			pluginId: source.plugin.package.name,
			sourceId: source.source.id,
			name: source.source.getName(),
		};
	}
}
