import { Injectable, Logger, NotFoundException } from "@nestjs/common";
import {
	AttributeValue,
	BufferAttributeValue,
	EphemeralSource,
	EphemeralSourceSearchOptions,
} from "@sdk";
import { LoadedPlugin } from "src/plugins/interface/loaded-plugin.interface";
import { LoadedEphemeralSource } from "./interface/loaded-ephemeral-source.interface";
import { LoadedAttributeSource } from "src/attributes/interface/loaded-attribute-source.interface";
import { AttributeSourcesService } from "src/attribute-sources/attribute-sources.service";
import { LoadedAttribute } from "src/attributes/interface/loaded-attribute.interface";
import {
	BasePersistentAttributeResponse,
	PersistentAttributeResponse,
	PersistentBooleanAttributeResponse,
	PersistentBufferAttributeResponse,
	PersistentDecimalAttributeResponse,
	PersistentIntegerAttributeResponse,
	PersistentStringAttributeResponse,
} from "src/attributes/response/persistent-attribute.response";
import { randomUUID } from "crypto";
import { RelativeUrl } from "src/interception/relative-url";

@Injectable()
export class EphemeralService {
	private readonly logger = new Logger("Ephemeral Service");
	private readonly sources = new Map<
		string,
		Map<string, LoadedEphemeralSource>
	>();
	private readonly attributeSources = new Map<
		EphemeralSource,
		LoadedAttributeSource
	>();
	private readonly proxiedBufferAttributes = new Map<
		string,
		BufferAttributeValue
	>();

	constructor(
		private readonly attributeSourcesService: AttributeSourcesService,
	) {}

	registerEphemeralSource(source: EphemeralSource, plugin: LoadedPlugin) {
		const pluginIdentifiers = this.sources.get(plugin.package.name);
		if (pluginIdentifiers) {
			if (pluginIdentifiers.has(source.id)) {
				throw new Error(
					`Plugin has already registered Ephemeral Source with ID "${source.id}"`,
				);
			}
			pluginIdentifiers.set(source.id, { source, plugin });
		} else {
			this.sources.set(
				plugin.package.name,
				new Map([[source.id, { source, plugin }]]),
			);
		}

		source.enable({
			useAttributeSource: (attributeSource) => {
				if (this.attributeSources.has(source)) {
					throw new Error(
						"Ephemeral source has already selected an Attribute Source",
					);
				}

				const allSources = this.attributeSourcesService.getSources();
				const loadedSource = allSources.find(
					({ source }) => source == attributeSource,
				);

				if (!loadedSource) {
					throw new Error("Attribute source is not loaded");
				}

				this.attributeSources.set(source, loadedSource);
			},
		});

		this.logger.log(
			`Plugin "${plugin.package.name}" registered Ephemeral Source "${source.id}"`,
		);
	}

	allFlat() {
		return Array.from(this.sources.values()).flatMap((set) =>
			Array.from(set.values()),
		);
	}

	find(pluginId: string, sourceId: string) {
		return this.sources.get(pluginId)?.get(sourceId) ?? null;
	}

	async search(
		source: LoadedEphemeralSource,
		options: EphemeralSourceSearchOptions,
	) {
		const attributeSource = this.attributeSources.get(source.source) ?? null;

		const results = await source.source.search(options);

		return {
			...results,
			attributeSource,
		};
	}

	createEphemeralAttributes(
		attributes: AttributeValue[],
		attributeSource: LoadedAttributeSource,
		possibleAttributes: LoadedAttribute[],
	): Record<string, PersistentAttributeResponse> {
		const attributeRecord: Record<
			string,
			BasePersistentAttributeResponse<any>
		> = {};

		for (const attribute of attributes) {
			const attributeTemplate = possibleAttributes.find(
				(possibleAttribute) => possibleAttribute.attribute.key == attribute.key,
			);

			if (!attributeTemplate) {
				throw new Error(
					`Plugin "${attributeSource.plugin.package.name}" has not registered an Attribute with key "${attribute.key}"`,
				);
			}

			function create<T>(
				constructor: new () => BasePersistentAttributeResponse<T>,
				value: T,
			) {
				const existingAttribute = attributeRecord[attribute.key];
				if (existingAttribute) {
					if (!(existingAttribute instanceof constructor)) {
						throw new Error(
							"Received multiple attributes of different types with the same key",
						);
					}
					if (attributeTemplate!.attribute.supportsMultiple) {
						throw new Error(
							"Received multiple values for an attribute that expects only one",
						);
					}
					existingAttribute.values.push(value);
				} else {
					const newAttribute = new constructor();
					newAttribute.values = [value];
					attributeRecord[attribute.key] = newAttribute;
				}
			}

			switch (attributeTemplate.attribute.type) {
				case "boolean":
					if (typeof attribute.value != "boolean") {
						throw new Error(
							`Plugin "${attributeSource.plugin.package.name}"'s Attribute with key "${attribute.key}" is type boolean`,
						);
					}
					create(PersistentBooleanAttributeResponse, attribute.value);
					break;
				case "string":
					if (typeof attribute.value != "string") {
						throw new Error(
							`Plugin "${attributeSource.plugin.package.name}"'s Attribute with key "${attribute.key}" is type string`,
						);
					}
					create(PersistentStringAttributeResponse, attribute.value);
					break;
				case "decimal":
					if (typeof attribute.value != "number") {
						throw new Error(
							`Plugin "${attributeSource.plugin.package.name}"'s Attribute with key "${attribute.key}" is type decimal`,
						);
					}
					if (attribute.value == Infinity) {
						throw new Error(
							`Plugin "${attributeSource.plugin.package.name}"'s Attribute with key "${attribute.key}" doesn't support Infinity`,
						);
					}
					create(PersistentDecimalAttributeResponse, attribute.value);
					break;
				case "integer":
					if (typeof attribute.value != "number" || attribute.value % 1 !== 0) {
						throw new Error(
							`Plugin "${attributeSource.plugin.package.name}"'s Attribute with key "${attribute.key}" is type integer`,
						);
					}
					create(PersistentIntegerAttributeResponse, attribute.value);
					break;
				case "buffer":
					if (
						typeof attribute.value != "object" ||
						!(
							"fetch" in attribute.value &&
							"extension" in attribute.value &&
							typeof attribute.value.fetch == "function" &&
							typeof attribute.value.extension == "string"
						)
					) {
						throw new Error(
							`Plugin "${attributeSource.plugin.package.name}"'s Attribute with key "${attribute.key}" is type buffer`,
						);
					}
					let uuid: string;
					do {
						uuid = randomUUID();
					} while (this.proxiedBufferAttributes.has(uuid));
					this.proxiedBufferAttributes.set(uuid, attribute.value);
					setTimeout(() => {
						this.proxiedBufferAttributes.delete(uuid);
					}, 30 * 60_000);

					create(PersistentBufferAttributeResponse, {
						extension: attribute.value.extension,
						sha256: null,
						uuid,
						url: new RelativeUrl(
							`/ephemeral/attribute-buffer/${uuid}.${attribute.value.extension}`,
						),
					});
					break;
			}
		}

		return attributeRecord;
	}

	getProxiedAttribute(uuid: string) {
		return this.proxiedBufferAttributes.get(uuid) ?? null;
	}
}
