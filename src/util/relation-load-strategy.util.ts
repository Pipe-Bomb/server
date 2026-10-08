import { EntityMetadata } from "typeorm";

export type RelationLoadStrategy = "join" | "query";

/**
 * Joining two or more independent to-many relations produces a cartesian
 * product whose row count is the product of every collection's cardinality.
 * That is what exhausts memory, so once the requested relation tree contains
 * that many to-many relations we fall back to separate `"query"` loads. Below
 * the threshold a single `"join"` is cheaper (one round trip, no extra
 * queries), which is why this cannot be a blanket `"query"` default.
 */
const TO_MANY_THRESHOLD = 2;

function countToManyRelations(
	metadata: EntityMetadata,
	relations: Record<string, unknown>,
): number {
	let count = 0;

	for (const [propertyPath, value] of Object.entries(relations)) {
		if (value === false || value === undefined || value === null) {
			continue;
		}

		const relation = metadata.findRelationWithPropertyPath(propertyPath);
		if (!relation) {
			continue;
		}

		if (relation.isOneToMany || relation.isManyToMany) {
			count++;
		}

		if (typeof value === "object") {
			count += countToManyRelations(
				relation.inverseEntityMetadata,
				value as Record<string, unknown>,
			);
		}
	}

	return count;
}

export function resolveRelationLoadStrategy(
	metadata: EntityMetadata,
	relations: object | undefined,
): RelationLoadStrategy {
	if (!relations) {
		return "join";
	}

	const count = countToManyRelations(
		metadata,
		relations as Record<string, unknown>,
	);

	return count >= TO_MANY_THRESHOLD ? "query" : "join";
}
