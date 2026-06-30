import { Injectable, Logger } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import {
	AttributeSource,
	Attribute,
	AttributeValue,
	AttributeFormatter,
	AttributeType,
	AttributeValues,
} from "@sdk";
import { CustomAttributeDto } from "src/attributes/dto/custom-attribute.dto";
import { OrderedAttributeSourceDto } from "src/attributes/dto/ordered-attribute-source.dto";
import { DBAlbumAttribute } from "src/attributes/entities/album-attribute.entity";
import { DBArtistAttribute } from "src/attributes/entities/artist-attribute.entity";
import { DBAttributeTemplate } from "src/attributes/entities/attribute.entity-template";
import { DBPlaylistAttribute } from "src/attributes/entities/playlist-attribute.entity";
import { DBTrackAttribute } from "src/attributes/entities/track-attribute.entity";
import { AttributeType as AttributeTypeEnum } from "src/attributes/enum/attribute-type.enum";
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
	private readonly albumAttributes = new Set<LoadedAttribute>();
	private readonly playlistAttributes = new Set<LoadedAttribute>();

	constructor(
		@InjectRepository(DBTrackAttribute)
		private readonly trackAttributesRepository: Repository<DBTrackAttribute>,
		@InjectRepository(DBArtistAttribute)
		private readonly artistAttributesRepository: Repository<DBArtistAttribute>,
		@InjectRepository(DBAlbumAttribute)
		private readonly albumAttributesRepository: Repository<DBAlbumAttribute>,
		@InjectRepository(DBPlaylistAttribute)
		private readonly playlistAttributesRepository: Repository<DBPlaylistAttribute>,
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
			registerAlbumAttributes: (attributes) => {
				for (const attribute of attributes) {
					this.registerAlbumAttribute(loadedAttributeSource, attribute);
				}
			},
			registerPlaylistAttributes: (attributes) => {
				for (const attribute of attributes) {
					this.registerPlaylistAttribute(loadedAttributeSource, attribute);
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

	doSourcesMatch(
		source1: LoadedAttributeSource | null,
		source2: LoadedAttributeSource | null,
	) {
		if (!source1 && !source2) {
			return true;
		}
		if (source1 && source2) {
			if (
				source1.plugin.package.name == source2.plugin.package.name &&
				source1.source.id == source2.source.id
			) {
				return true;
			}
		}
		return false;
	}

	private registerAttribute(
		source: LoadedAttributeSource | null,
		attribute: Attribute,
		set: Set<LoadedAttribute>,
		debugName: string,
	) {
		for (const loadedAttribute of set) {
			if (
				this.doSourcesMatch(source, loadedAttribute.source) &&
				loadedAttribute.attribute.key == attribute.key
			) {
				if (source) {
					throw new Error(
						`Plugin "${source.plugin.package.name}"'s Attribute Source "${source.source.id}" has already registered a "${debugName}" Attribute with key "${attribute.key}"`,
					);
				} else {
					throw new Error(
						`Custom "${debugName}" Attribute has already been registered with key "${attribute.key}"`,
					);
				}
			}
		}

		if (source) {
			this.logger.debug(
				`Plugin "${source.plugin.package.name}"'s Attribute Source "${source.source.id}" registered "${debugName}" Attribute "${attribute.key}" (${attribute.type})`,
			);
		} else {
			this.logger.debug(
				`Custom "${debugName}" Attribute "${attribute.key}" (${attribute.type}) registered`,
			);
		}

		set.add({
			attribute,
			source,
		});
	}

	registerTrackAttribute(
		source: LoadedAttributeSource | null,
		attribute: Attribute,
	) {
		this.registerAttribute(source, attribute, this.trackAttributes, "track");
	}

	registerArtistAttribute(
		source: LoadedAttributeSource | null,
		attribute: Attribute,
	) {
		this.registerAttribute(source, attribute, this.artistAttributes, "artist");
	}

	registerAlbumAttribute(
		source: LoadedAttributeSource | null,
		attribute: Attribute,
	) {
		this.registerAttribute(source, attribute, this.albumAttributes, "album");
	}

	registerPlaylistAttribute(
		source: LoadedAttributeSource | null,
		attribute: Attribute,
	) {
		this.registerAttribute(
			source,
			attribute,
			this.playlistAttributes,
			"playlist",
		);
	}

	public getTrackAttributes() {
		return Array.from(this.trackAttributes.values());
	}

	public getArtistAttributes() {
		return Array.from(this.artistAttributes.values());
	}

	public getAlbumAttributes() {
		return Array.from(this.albumAttributes.values());
	}

	public getPlaylistAttributes() {
		return Array.from(this.playlistAttributes.values());
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
			this.getTrackAttributes().filter((attribute) =>
				this.doSourcesMatch(source, attribute.source),
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
			this.getArtistAttributes().filter((attribute) =>
				this.doSourcesMatch(source, attribute.source),
			),
		);
	}

	public async createAlbumAttributes(
		albumUuid: string,
		attributes: AttributeValue[],
		source: LoadedAttributeSource,
	) {
		return this.createDBAttributes(
			this.albumAttributesRepository,
			albumUuid,
			attributes,
			source,
			this.getAlbumAttributes().filter((attribute) =>
				this.doSourcesMatch(source, attribute.source),
			),
		);
	}

	public async createPlaylistAttributes(
		playlistUuid: string,
		attributes: AttributeValue[],
		source: LoadedAttributeSource | null,
	) {
		return this.createDBAttributes(
			this.playlistAttributesRepository,
			playlistUuid,
			attributes,
			source,
			this.getPlaylistAttributes().filter((attribute) =>
				this.doSourcesMatch(source, attribute.source),
			),
		);
	}

	customToAttributeValues(attributes: CustomAttributeDto[]): AttributeValue[] {
		const output: AttributeValue[] = [];

		for (const attribute of attributes) {
			if (attribute.type == AttributeTypeEnum.BUFFER) {
				output.push({
					key: attribute.key,
					value: {
						buffer: attribute.value,
						extension: attribute.extension,
					},
				});
			} else {
				output.push({
					key: attribute.key,
					value: attribute.value,
				});
			}
		}

		return output;
	}

	private async createDBAttributes<T extends DBAttributeTemplate>(
		repository: Repository<T>,
		entityId: string,
		attributes: AttributeValue[],
		source: LoadedAttributeSource | null,
		possibleAttributes: LoadedAttribute[],
	): Promise<T[]> {
		const ordinalCount: Record<string, number> = {};
		const result: T[] = [];
		for (const attribute of attributes) {
			const attributeTemplate = possibleAttributes.find(
				(possibleAttribute) => possibleAttribute.attribute.key == attribute.key,
			);
			if (!attributeTemplate) {
				if (source) {
					throw new Error(
						`Plugin "${source.plugin.package.name}" has not registered an Attribute with key "${attribute.key}"`,
					);
				} else {
					throw new Error(
						`Custom Attribute has not been registered with key "${attribute.key}"`,
					);
				}
			}

			try {
				const dbAttribute = await (async () => {
					const entity = repository.create({
						entityId,
						entityRelationId: entityId,
						pluginId: source?.plugin.package.name ?? "",
						sourceId: source?.source.id ?? "",
						key: attribute.key,
					} as DeepPartial<T>);

					const attributeType = attributeTemplate.attribute.type;
					switch (attributeType) {
						case "boolean":
							if (typeof attribute.value != "boolean") {
								if (source) {
									throw new Error(
										`Plugin "${source.plugin.package.name}"'s Attribute with key "${attribute.key}" is type boolean`,
									);
								} else {
									throw new Error(
										`Custom Attribute with key "${attribute.key}" is type boolean`,
									);
								}
							}
							entity.value_boolean = attribute.value;
							break;
						case "string":
							if (typeof attribute.value != "string") {
								if (source) {
									throw new Error(
										`Plugin "${source.plugin.package.name}"'s Attribute with key "${attribute.key}" is type string`,
									);
								} else {
									throw new Error(
										`Custom Attribute with key "${attribute.key}" is type string`,
									);
								}
							}
							entity.value_string = attribute.value;
							break;
						case "decimal":
							if (typeof attribute.value != "number") {
								if (source) {
									throw new Error(
										`Plugin "${source.plugin.package.name}"'s Attribute with key "${attribute.key}" is type decimal`,
									);
								} else {
									throw new Error(
										`Custom Attribute with key "${attribute.key}" is type decimal`,
									);
								}
							}
							if (attribute.value == Infinity) {
								if (source) {
									throw new Error(
										`Plugin "${source.plugin.package.name}"'s Attribute with key "${attribute.key}" doesn't support Infinity`,
									);
								} else {
									throw new Error(
										`Custom Attribute with key "${attribute.key}" doesn't support Infinity`,
									);
								}
							}
							entity.value_decimal = attribute.value;
							break;
						case "integer":
							if (
								typeof attribute.value != "number" ||
								attribute.value % 1 !== 0
							) {
								if (source) {
									throw new Error(
										`Plugin "${source.plugin.package.name}"'s Attribute with key "${attribute.key}" is type integer`,
									);
								} else {
									throw new Error(
										`Custom Attribute with key "${attribute.key}" is type integer`,
									);
								}
							}
							if (attribute.value == Infinity) {
								if (source) {
									throw new Error(
										`Plugin "${source.plugin.package.name}"'s Attribute with key "${attribute.key}" doesn't support Infinity`,
									);
								} else {
									throw new Error(
										`Custom Attribute with key "${attribute.key}" doesn't support Infinity`,
									);
								}
							}
							entity.value_int = attribute.value;
							break;
						case "buffer":
							if (
								typeof attribute.value != "object" ||
								!(
									"buffer" in attribute.value &&
									"extension" in attribute.value &&
									(typeof attribute.value.buffer == "function" ||
										Buffer.isBuffer(attribute.value.buffer)) &&
									typeof attribute.value.extension == "string"
								)
							) {
								if (source) {
									throw new Error(
										`Plugin "${source.plugin.package.name}"'s Attribute with key "${attribute.key}" is type buffer`,
									);
								} else {
									throw new Error(
										`Custom Attribute with key "${attribute.key}" is type buffer`,
									);
								}
							}
							let buffer: Buffer;
							if (Buffer.isBuffer(attribute.value.buffer)) {
								buffer = attribute.value.buffer;
							} else {
								buffer = await attribute.value.buffer();
							}
							entity.value_buffer = await this.resourcesService.create(
								buffer,
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
			} catch (e) {
				this.logger.error(
					`Failed to create attribute with key "${attribute.key}":`,
					e,
				);
			}
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

	public async replaceAllAlbumAttributes(
		albumUuid: string,
		attributes: DBAlbumAttribute[],
	) {
		await this.albumAttributesRepository.delete({
			entityId: albumUuid,
		});
		await this.albumAttributesRepository.insert(attributes);
	}

	public async upsertTrackAttributes(attributes: DBTrackAttribute[]) {
		await this.trackAttributesRepository.upsert(attributes, {
			conflictPaths: ["pluginId", "entityId", "sourceId", "ordinal", "key"],
		});
	}

	public async upsertArtistAttributes(attributes: DBArtistAttribute[]) {
		await this.artistAttributesRepository.upsert(attributes, {
			conflictPaths: ["pluginId", "entityId", "sourceId", "ordinal", "key"],
		});
	}

	public async upsertPlaylistAttributes(
		playlistUuid: string,
		attributes: DBPlaylistAttribute[],
	) {
		const keys = attributes.map(({ key }) => key);

		await this.playlistAttributesRepository.delete({
			entityId: playlistUuid,
			key: In(keys),
		});

		await this.playlistAttributesRepository.insert(attributes);
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
		type: "track" | "artist" | "album" | "playlist" | null,
	): Record<string, PersistentAttributeResponse>;
	toMap<T extends DBAttributeTemplate>(
		attributes: T[] | null,
		type: "track" | "artist" | "album" | "playlist" | null,
	): Record<string, PersistentAttributeResponse> | null;
	toMap<T extends DBAttributeTemplate>(
		attributes: T[] | null,
		type: "track" | "artist" | "album" | "playlist" | null,
	) {
		if (!attributes) {
			return null;
		}

		const format = type && this.getFormatter(type);

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
			let finalResponse: PersistentAttributeResponse | null = null;

			if (
				values.some((attribute) => !attribute.pluginId && !attribute.sourceId)
			) {
				const responses = values
					.filter((attribute) => !attribute.pluginId && !attribute.sourceId)
					.map((attribute) => attribute.toResponse());
				finalResponse = responses[0];
				for (let i = 1; i < responses.length; i++) {
					(finalResponse.values as any[]).push(...responses[i].values);
				}
			} else {
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

						finalResponse = responses[0];
						for (let i = 1; i < responses.length; i++) {
							(finalResponse.values as any[]).push(...responses[i].values);
						}
						break;
					}
				}
			}

			if (!finalResponse) {
				continue;
			}

			if (!format || finalResponse.type == AttributeTypeEnum.BUFFER) {
				finalResponse.formatted = null;
			} else {
				finalResponse.formatted = finalResponse.values.map((value) =>
					format(
						finalResponse.pluginId,
						finalResponse.sourceId,
						key,
						finalResponse.type,
						value as string | number | boolean,
					),
				);
			}

			output[key] = finalResponse;
		}

		return output;
	}

	getSources() {
		return [...this.sources];
	}

	getFormatter(type: "track" | "artist" | "album" | "playlist") {
		const attributeSet = {
			track: this.trackAttributes,
			artist: this.artistAttributes,
			album: this.albumAttributes,
			playlist: this.playlistAttributes,
		}[type];

		const formatterMap = new Map<
			string,
			{
				formatter: AttributeFormatter;
				pluginId: string;
				sourceId: string;
				priority: number;
			}
		>();

		for (const { attribute, source } of attributeSet) {
			if (attribute.type != "buffer" && attribute.formatter) {
				const key = `${attribute.key}:${attribute.type}`;

				let index = 0;
				if (source) {
					const sourceIndex = this.sources.indexOf(source);
					if (sourceIndex >= 0) {
						index = sourceIndex + 1;
					}
				}

				const currentFormatter = formatterMap.get(key);
				if (currentFormatter && currentFormatter.priority < index) {
					continue;
				}

				formatterMap.set(key, {
					formatter: attribute.formatter as AttributeFormatter<any>,
					pluginId: source?.plugin.package.name ?? "",
					sourceId: source?.source.id ?? "",
					priority: index,
				});
			}
		}

		return <T extends AttributeType>(
			_pluginId: string,
			_sourceId: string,
			key: string,
			valueType: AttributeType,
			value: AttributeValues[T],
		) => {
			const mapKey = `${key}:${valueType}`;
			const formatter = formatterMap.get(mapKey);
			if (formatter) {
				return formatter.formatter(value);
			}
			return value.toString();
		};
	}
}
