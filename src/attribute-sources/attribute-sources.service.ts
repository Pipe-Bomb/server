import { Injectable, Logger } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import {
	AttributeSource,
	Attribute,
	AttributeValue,
	AttributeFormatter,
	BufferAttributeFormatter,
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
import { ResolvedAttributeDefinition } from "src/attributes/interface/resolved-attribute-definition.interface";
import { LoadedPlugin } from "src/plugins/interface/loaded-plugin.interface";
import { ResourceManagerService } from "src/resource-manager/resource-manager.service";
import { ResourceResponse } from "src/resource-manager/response/resource.response";
import { RelativeUrl } from "src/interception/relative-url";
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
		private readonly resourceManagerService: ResourceManagerService,
	) {}

	unregisterAttributeSource(plugin: LoadedPlugin, source: AttributeSource) {
		const index = this.sources.findIndex(
			(s) =>
				s.plugin.package.name === plugin.package.name && s.source === source,
		);
		if (index === -1) {
			return;
		}
		const [loaded] = this.sources.splice(index, 1);
		for (const attr of [...this.trackAttributes]) {
			if (attr.source === loaded) {
				this.trackAttributes.delete(attr);
			}
		}
		for (const attr of [...this.artistAttributes]) {
			if (attr.source === loaded) {
				this.artistAttributes.delete(attr);
			}
		}
		for (const attr of [...this.albumAttributes]) {
			if (attr.source === loaded) {
				this.albumAttributes.delete(attr);
			}
		}
		for (const attr of [...this.playlistAttributes]) {
			if (attr.source === loaded) {
				this.playlistAttributes.delete(attr);
			}
		}
		this.logger.log(
			`Plugin "${plugin.package.name}" unregistered Attribute Source "${source.id}"`,
		);
	}

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

	getAttributeSource(pluginId: string, sourceId: string) {
		return (
			this.sources.find(
				({ plugin, source }) =>
					plugin.package.name == pluginId && source.id == sourceId,
			) ?? null
		);
	}

	getBufferAttributeFormatter(
		type: "track" | "artist" | "album" | "playlist",
		pluginId: string,
		sourceId: string,
		key: string,
	): BufferAttributeFormatter | null {
		for (const loaded of this.getAttributeSet(type)) {
			if (
				loaded.attribute.key != key ||
				loaded.attribute.type != "buffer" ||
				!loaded.source
			) {
				continue;
			}

			if (
				loaded.source.plugin.package.name == pluginId &&
				loaded.source.source.id == sourceId
			) {
				return loaded.attribute.formatter ?? null;
			}
		}

		return null;
	}

	buildFormattedBufferResource(
		resource: ResourceResponse,
		pluginId: string,
		sourceId: string,
		entity: string,
		key: string,
	): ResourceResponse {
		const query = new URLSearchParams({
			plugin: pluginId,
			source: sourceId,
			entity,
			key,
		});

		return {
			uuid: resource.uuid,
			url: new RelativeUrl(`${resource.url.url}?${query.toString()}`),
			extension: resource.extension,
			sha256: null,
		};
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
							entity.value_buffer = await this.resourceManagerService.create(
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
		attributeSource: LoadedAttributeSource | null,
		attributes: DBPlaylistAttribute[],
	) {
		const keys = attributes.map(({ key }) => key);

		await this.playlistAttributesRepository.delete({
			entityId: playlistUuid,
			pluginId: attributeSource?.plugin.package.name ?? "",
			sourceId: attributeSource?.source.id ?? "",
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

		const output: Record<string, PersistentAttributeResponse> = {};

		if (!type) {
			return output;
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

		for (const [key, values] of map) {
			const definition = this.resolveAttributeDefinition(type, key);
			if (!definition) {
				continue;
			}

			const candidates: {
				group: number;
				ordinal: number;
				response: PersistentAttributeResponse;
			}[] = [];

			for (const attribute of values) {
				let group: number;
				if (!attribute.pluginId && !attribute.sourceId) {
					group = -1;
				} else {
					group = this.sources.findIndex(
						(source) =>
							source.plugin.package.name == attribute.pluginId &&
							source.source.id == attribute.sourceId,
					);
					if (group < 0) {
						continue;
					}
				}

				let response: PersistentAttributeResponse;
				try {
					response = attribute.toResponse();
				} catch {
					continue;
				}

				if (String(response.type) !== String(definition.type)) {
					continue;
				}

				candidates.push({ group, ordinal: attribute.ordinal, response });
			}

			if (!candidates.length) {
				continue;
			}

			candidates.sort((a, b) => a.group - b.group || a.ordinal - b.ordinal);

			// Only the first source that provides values is used; values from
			// other sources are never combined. Source-less (custom) rows rank
			// first and are reported as having no source.
			const firstSource = candidates[0].group;
			const firstSourceCandidates = candidates.filter(
				(candidate) => candidate.group === firstSource,
			);

			const selected = definition.supportsMultiple
				? firstSourceCandidates
				: firstSourceCandidates.slice(0, 1);

			const finalResponse = selected[0].response;
			finalResponse.pluginId =
				firstSource === -1 ? null : finalResponse.pluginId;
			finalResponse.sourceId =
				firstSource === -1 ? null : finalResponse.sourceId;

			for (let i = 1; i < selected.length; i++) {
				(finalResponse.values as any[]).push(...selected[i].response.values);
			}

			finalResponse.formatterPluginId = definition.pluginId || null;
			finalResponse.formatterSourceId = definition.sourceId || null;

			if (definition.type === "buffer") {
				// Buffer formatters are applied on demand by the resources
				// endpoint, so the formatted representation is a URL pointing at
				// it with the formatter's query parameters.
				const formatter = this.getBufferAttributeFormatter(
					type,
					definition.pluginId,
					definition.sourceId,
					key,
				);

				finalResponse.formatted = formatter
					? (finalResponse.values as ResourceResponse[]).map((value) =>
							this.buildFormattedBufferResource(
								value,
								definition.pluginId,
								definition.sourceId,
								type,
								key,
							),
						)
					: null;
			} else {
				finalResponse.formatted = finalResponse.values.map((value) =>
					this.formatAttributeValue(
						definition,
						value as string | number | boolean,
					),
				);
			}

			output[key] = finalResponse;
		}

		return output;
	}

	public resolveAttributeDefinition(
		type: "track" | "artist" | "album" | "playlist",
		key: string,
	): ResolvedAttributeDefinition | null {
		const candidates: { priority: number; loaded: LoadedAttribute }[] = [];

		for (const loaded of this.getAttributeSet(type)) {
			if (loaded.attribute.key !== key) {
				continue;
			}

			let priority: number;
			if (loaded.source) {
				priority = this.sources.indexOf(loaded.source);
				if (priority < 0) {
					continue;
				}
			} else {
				priority = this.sources.length;
			}

			candidates.push({ priority, loaded });
		}

		if (!candidates.length) {
			return null;
		}

		candidates.sort((a, b) => a.priority - b.priority);

		const attribute = candidates[0].loaded.attribute;

		const formatterLoaded =
			candidates.find(
				(candidate) =>
					candidate.loaded.attribute.type === attribute.type &&
					candidate.loaded.attribute.formatter,
			)?.loaded ?? null;

		return {
			type: attribute.type,
			supportsMultiple: attribute.supportsMultiple,
			pluginId: formatterLoaded?.source?.plugin.package.name ?? "",
			sourceId: formatterLoaded?.source?.source.id ?? "",
			formatter:
				attribute.type === "buffer"
					? null
					: ((formatterLoaded?.attribute.formatter as AttributeFormatter) ??
						null),
		};
	}

	public formatAttributeValue(
		definition: ResolvedAttributeDefinition,
		value: string | number | boolean,
	): string {
		return definition.formatter
			? definition.formatter(value)
			: value.toString();
	}

	private getAttributeSet(type: "track" | "artist" | "album" | "playlist") {
		return {
			track: this.trackAttributes,
			artist: this.artistAttributes,
			album: this.albumAttributes,
			playlist: this.playlistAttributes,
		}[type];
	}

	getSources() {
		return [...this.sources];
	}
}
