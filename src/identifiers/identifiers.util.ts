import { Identifier, IdentifierDependency } from "@sdk";
import { LoadedIdentifier } from "./interface/loaded-identifier";
import { ExistingDependency } from "./interface/existing-identifier-dependency.interface";

export function orderIdentifiers<T extends Identifier>(
	inputs: LoadedIdentifier<T>[],
	withDependencies?: ExistingDependency[],
) {
	// Helper to generate unique keys for the Map
	const getFullId = (pluginId: string, id: string) => `${pluginId}:${id}`;

	// 0. Map existing external dependencies for quick lookup
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

	// 1. Resolve Dependency Keys Helper
	const resolveDepKey = (ownerPluginId: string, dep: IdentifierDependency) => {
		return getFullId(dep.pluginId ?? ownerPluginId, dep.sourceId);
	};

	// 2. Recursive Pruning of missing hard dependencies
	const validKeys = new Set<string>();
	const invalidKeys = new Set<string>();

	function checkValidity(
		key: string,
		visited: Set<string> = new Set(),
	): boolean {
		if (invalidKeys.has(key)) return false;
		if (validKeys.has(key)) return true;
		if (visited.has(key)) return true; // Potential cycle, handled in Kahn's

		const item = idMap.get(key);

		// If the identifier is not in the current input batch,
		// we check if it was passed as an existing dependency.
		if (!item) {
			return externalSet.has(key);
		}

		// If it is in the batch, we recursively validate its hard dependencies
		visited.add(key);
		const ownerPluginId = item.plugin.package.name;

		for (const dep of item.identifier.getDependencies()) {
			const depKey = resolveDepKey(ownerPluginId, dep);
			if (!checkValidity(depKey, visited)) {
				invalidKeys.add(key);
				return false;
			}
		}
		validKeys.add(key);
		return true;
	}

	// Filter only those inputs that have all hard dependencies met (either in inputs or external)
	const prunedKeys = Array.from(idMap.keys()).filter((key) =>
		checkValidity(key),
	);
	const prunedIdMap = new Map(prunedKeys.map((k) => [k, idMap.get(k)!]));

	// 3. Graph Building
	const adj = new Map<string, Set<string>>();
	const hardInDegree = new Map<string, number>();
	const softInDegree = new Map<string, number>();

	for (const key of prunedKeys) {
		adj.set(key, new Set());
		hardInDegree.set(key, 0);
		softInDegree.set(key, 0);
	}

	for (const [key, item] of prunedIdMap) {
		const pluginId = item.plugin.package.name;

		// Hard Dependencies
		for (const dep of item.identifier.getDependencies()) {
			const depKey = resolveDepKey(pluginId, dep);
			// We only add edges for dependencies within the current pruned batch.
			// External dependencies are already satisfied and don't affect internal ordering.
			if (prunedIdMap.has(depKey)) {
				adj.get(depKey)!.add(key);
				hardInDegree.set(key, hardInDegree.get(key)! + 1);
			}
		}

		// Soft Dependencies
		for (const dep of item.identifier.getSoftDependencies()) {
			const depKey = resolveDepKey(pluginId, dep);
			if (prunedIdMap.has(depKey)) {
				adj.get(depKey)!.add(key);
				softInDegree.set(key, softInDegree.get(key)! + 1);
			}
		}
	}

	// 4. Topological Sort (Modified Kahn's)
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
				const depPluginId = dependent.plugin.package.name;

				const isHard = dependent.identifier
					.getDependencies()
					.some((d) => resolveDepKey(depPluginId, d) === key);

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
