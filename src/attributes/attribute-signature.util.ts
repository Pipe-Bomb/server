import { DBAttributeTemplate } from "./entities/attribute.entity-template";

export function attributeSignature(attributes: DBAttributeTemplate[]): string {
	return attributes
		.map((attribute) =>
			[
				attribute.pluginId,
				attribute.sourceId,
				attribute.key,
				attribute.ordinal,
				attribute.value_string,
				attribute.value_int,
				attribute.value_decimal,
				attribute.value_boolean,
				attribute.value_buffer?.uuid ?? null,
			].join(":"),
		)
		.sort()
		.join("|");
}
