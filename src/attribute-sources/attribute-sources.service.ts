import { Injectable, Logger } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { AttributeSource, Attribute, AttributeValue } from "@sdk";
import { OrderedAttributeSourceDto } from "src/attributes/dto/ordered-attribute-source.dto";
import { DBArtistAttribute } from "src/attributes/entities/artist-attribute.entity";
import { DBAttributeTemplate } from "src/attributes/entities/attribute.entity-template";
import { DBTrackAttribute } from "src/attributes/entities/track-attribute.entity";
import { LoadedAttributeSource } from "src/attributes/interface/loaded-attribute-source.interface";
import { LoadedAttribute } from "src/attributes/interface/loaded-attribute.interface";
import { PersistentAttributeResponse } from "src/attributes/response/persistent-attribute.response";
import { LoadedPlugin } from "src/plugins/interface/loaded-plugin.interface";
import { ResourcesService } from "src/resources/resources.service";
import { TasksService } from "src/tasks/tasks.service";
import { DeepPartial, In, Repository } from "typeorm";

@Injectable()
export class AttributeSourcesService {
	private readonly logger = new Logger("Attribute Sources Service");

	private readonly sources: LoadedAttributeSource[] = [];
	private readonly trackAttributes = new Set<LoadedAttribute>();
	private readonly artistAttributes = new Set<LoadedAttribute>();

	constructor(
		@InjectRepository(DBTrackAttribute)
		private readonly trackAttributesRepository: Repository<DBTrackAttribute>,
		@InjectRepository(DBArtistAttribute)
		private readonly artistAttributesRepository: Repository<DBArtistAttribute>,
		private readonly tasksService: TasksService,
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
			getLogger: () => new Logger(`ATTRIBUTE SOURCE ${source.getName()}`),
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

	public getTrackAttributes() {
		return Array.from(this.trackAttributes.values());
	}

	public getArtistAttributes() {
		return Array.from(this.artistAttributes.values());
	}

	public async createTrackAttributes(
		trackId: string,
		attributes: AttributeValue[],
		source: LoadedAttributeSource,
	) {
		return this.createDBAttributes(
			this.trackAttributesRepository,
			trackId,
			attributes,
			source,
			this.getTrackAttributes().filter(
				(attribute) =>
					attribute.source.plugin.package.name == source.plugin.package.name &&
					attribute.source.source.id == source.source.id,
			),
		);
	}

	public async createArtistAttributes(
		artistUuid: string,
		attributes: AttributeValue[],
		source: LoadedAttributeSource,
	) {
		return this.createDBAttributes(
			this.artistAttributesRepository,
			artistUuid,
			attributes,
			source,
			this.getArtistAttributes().filter(
				(attribute) =>
					attribute.source.plugin.package.name == source.plugin.package.name &&
					attribute.source.source.id == source.source.id,
			),
		);
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
					entityRelationId: entityId,
					pluginId: source.plugin.package.name,
					sourceId: source.source.id,
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

	public async replaceAllArtistAttributes(
		artistUuid: string,
		attributes: DBArtistAttribute[],
	) {
		await this.artistAttributesRepository.delete({
			entityId: artistUuid,
		});
		await this.artistAttributesRepository.insert(attributes);
	}

	public async upsertTrackAttributes(attributes: DBTrackAttribute[]) {
		await this.trackAttributesRepository.upsert(attributes, {
			conflictPaths: ["pluginId", "entityId", "sourceId", "ordinal", "key"],
		});
	}

	public async upsertArtistAttribtues(attributes: DBArtistAttribute[]) {
		await this.artistAttributesRepository.upsert(attributes, {
			conflictPaths: ["pluginId", "entityId", "sourceId", "ordinal", "key"],
		});
	}

	setSourceOrder(order: OrderedAttributeSourceDto[]) {
		const output: LoadedAttributeSource[] = [];
		for (const entry of order) {
			const source = this.sources.find(
				(source) =>
					source.plugin.package.name == entry.pluginId &&
					source.source.id == entry.sourceId,
			);
			if (source && !output.includes(source)) {
				output.push(source);
			}
		}

		for (const source of this.sources) {
			if (!output.includes(source)) {
				output.push(source);
			}
		}

		this.sources.splice(0, this.sources.length, ...output);
	}

	toMap<T extends DBAttributeTemplate>(
		attributes: T[],
	): Record<string, PersistentAttributeResponse>;
	toMap<T extends DBAttributeTemplate>(
		attributes: T[] | null,
	): Record<string, PersistentAttributeResponse> | null;
	toMap<T extends DBAttributeTemplate>(attributes: T[] | null) {
		if (!attributes) {
			return null;
		}

		const map = new Map<string, T[]>();

		for (const attribute of attributes) {
			const array = map.get(attribute.key);
			if (array) {
				array.push(attribute);
			} else {
				map.set(attribute.key, [attribute]);
			}
		}

		const output: Record<string, PersistentAttributeResponse> = {};

		for (const [key, values] of map) {
			for (const { source, plugin } of this.sources) {
				if (
					values.some(
						(attribute) =>
							attribute.pluginId == plugin.package.name &&
							attribute.sourceId == source.id,
					)
				) {
					const responses = values
						.filter(
							(attribute) =>
								attribute.pluginId == plugin.package.name &&
								attribute.sourceId == source.id,
						)
						.map((attribute) => attribute.toResponse());

					for (let i = 1; i < responses.length; i++) {
						(responses[0].values as any[]).push(...responses[i].values);
					}

					output[key] = responses[0];
					break;
				}
			}
		}

		return output;
	}

	getSources() {
		return [...this.sources];
	}
}
