import { DBAttributeTemplate } from "./entities/attribute.entity-template";
import { PersistentAttributeResponse } from "./response/persistent-attribute.response";

export function toSimplifiedAttributeList(attributes: DBAttributeTemplate[]) {
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
