import { Identifier, IdentifierDependency } from "@sdk";
import { LoadedIdentifier } from "./interface/loaded-identifier";
import { ExistingDependency } from "./interface/existing-identifier-dependency.interface";

export function orderIdentifiers<T extends Identifier>(
	inputs: LoadedIdentifier<T>[],
	withDependencies?: ExistingDependency[],
) {
	const getFullId = (pluginId: string, id: string) => `${pluginId}:${id}`;

	const externalSet = new Set<string>();
	if (withDependencies) {
		for (const dep of withDependencies) {
			externalSet.add(getFullId(dep.pluginId, dep.sourceId));
		}
	}

	const idMap = new Map<string, LoadedIdentifier<T>>();
	for (const item of inputs) {
		const key = getFullId(item.plugin.package.name, item.identifier.id);
		idMap.set(key, item);
	}

	const resolveDepKey = (dep: IdentifierDependency): string => {
		if (dep.pluginId != null) {
			return getFullId(dep.pluginId, dep.sourceId);
		}

		const suffix = `:${dep.sourceId}`;

		for (const key of idMap.keys()) {
			if (key.endsWith(suffix)) return key;
		}

		for (const key of externalSet) {
			if (key.endsWith(suffix)) return key;
		}

		return getFullId("*", dep.sourceId);
	};

	const validKeys = new Set<string>();
	const invalidKeys = new Set<string>();

	function checkValidity(
		key: string,
		visited: Set<string> = new Set(),
	): boolean {
		if (invalidKeys.has(key)) return false;
		if (validKeys.has(key)) return true;
		if (visited.has(key)) return true;

		const item = idMap.get(key);
		if (!item) {
			return externalSet.has(key);
		}

		visited.add(key);

		for (const dep of item.identifier.getDependencies()) {
			const depKey = resolveDepKey(dep);
			if (!checkValidity(depKey, visited)) {
				invalidKeys.add(key);
				return false;
			}
		}
		validKeys.add(key);
		return true;
	}

	const prunedKeys = Array.from(idMap.keys()).filter((key) =>
		checkValidity(key),
	);
	const prunedIdMap = new Map(prunedKeys.map((k) => [k, idMap.get(k)!]));

	const adj = new Map<string, Set<string>>();
	const hardInDegree = new Map<string, number>();
	const softInDegree = new Map<string, number>();

	for (const key of prunedKeys) {
		adj.set(key, new Set());
		hardInDegree.set(key, 0);
		softInDegree.set(key, 0);
	}

	for (const [key, item] of prunedIdMap) {
		for (const dep of item.identifier.getDependencies()) {
			const depKey = resolveDepKey(dep);
			if (prunedIdMap.has(depKey)) {
				adj.get(depKey)!.add(key);
				hardInDegree.set(key, hardInDegree.get(key)! + 1);
			}
		}

		for (const dep of item.identifier.getSoftDependencies()) {
			const depKey = resolveDepKey(dep);
			if (prunedIdMap.has(depKey)) {
				adj.get(depKey)!.add(key);
				softInDegree.set(key, softInDegree.get(key)! + 1);
			}
		}
	}

	const result: LoadedIdentifier<T>[] = [];
	const remainingKeys = new Set(prunedKeys);

	while (remainingKeys.size > 0) {
		let ready = Array.from(remainingKeys).filter(
			(k) => hardInDegree.get(k) === 0 && softInDegree.get(k) === 0,
		);

		if (ready.length === 0) {
			const onlyHardReady = Array.from(remainingKeys).filter(
				(k) => hardInDegree.get(k) === 0,
			);

			if (onlyHardReady.length === 0) {
				break;
			}
			ready = [onlyHardReady[0]];
		}

		for (const key of ready) {
			const item = prunedIdMap.get(key)!;
			result.push(item);
			remainingKeys.delete(key);

			for (const dependentKey of adj.get(key) || []) {
				const dependent = prunedIdMap.get(dependentKey)!;

				const isHard = dependent.identifier
					.getDependencies()
					.some((d) => resolveDepKey(d) === key);

				if (isHard) {
					hardInDegree.set(dependentKey, hardInDegree.get(dependentKey)! - 1);
				} else {
					softInDegree.set(dependentKey, softInDegree.get(dependentKey)! - 1);
				}
			}
		}
	}

	return result;
}
