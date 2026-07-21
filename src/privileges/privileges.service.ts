import { Injectable, Logger } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { DBPrivilege } from "./entity/privilege.entity";
import {
	DataSource,
	FindOptionsWhere,
	QueryDeepPartialEntity,
	Repository,
} from "typeorm";
import { SystemPrivilege } from "./interface/system-privilege.interface";
import { DBUser } from "src/users/entity/user.entity";
import { UpdatePrivilegeDto } from "./dto/update-privilege.dto";
import { PrivilegeResponse } from "./response/privilege.response";

@Injectable()
export class PrivilegesService {
	private readonly adminUuids =
		process.env.ADMINS?.split(",")
			.map((username) => username.trim())
			.filter((username) => !!username) ?? [];
	private readonly systemPrivileges = new Map<string, SystemPrivilege>();

	private readonly logger = new Logger("Privileges Service");

	constructor(
		@InjectRepository(DBPrivilege)
		private readonly privilegesRepository: Repository<DBPrivilege>,
		private readonly dataSource: DataSource,
	) {
		if (this.adminUuids.length) {
			this.logger.log(`There are ${this.adminUuids.length} admin UUIDs:`);
			for (const uuid of this.adminUuids) {
				this.logger.log(`- ${uuid}`);
			}
		} else {
			this.logger.warn(
				"No admin UUIDs specified. Most configuration options are locked.",
			);
		}
	}

	isAdmin(userUuid: string) {
		return this.adminUuids.includes(userUuid);
	}

	async getPrivileges(userUuid: string) {
		return this.privilegesRepository.findBy({
			userUuid,
		});
	}

	async registerPrivilege(
		pluginId: string | null,
		privilegeKey: string,
		includedIn?: string[],
	) {
		if (pluginId) {
			throw new Error("Not implemented");
		}

		if (this.systemPrivileges.has(privilegeKey)) {
			throw new Error(
				`System privilege "${privilegeKey}" has already been registered`,
			);
		}

		for (const dependency of includedIn ?? []) {
			if (!this.systemPrivileges.has(dependency)) {
				throw new Error(`Dependency "${dependency}" does not exist`);
			}
		}

		this.systemPrivileges.set(privilegeKey, {
			key: privilegeKey,
			includedIn: Array.from(new Set(includedIn ?? [])),
		});
		this.logger.debug(`System registered privilege "${privilegeKey}"`);
	}

	allSystemPrivileges() {
		return Array.from(this.systemPrivileges.values());
	}

	updatePrivileges(user: DBUser, privileges: UpdatePrivilegeDto[]) {
		return this.dataSource.transaction(async (entityManager) => {
			const toDelete: FindOptionsWhere<DBPrivilege>[] = [];
			const toAdd: QueryDeepPartialEntity<DBPrivilege>[] = [];
			for (const privilege of privileges) {
				if (privilege.granted) {
					toAdd.push({
						userUuid: user.uuid,
						pluginId: privilege.pluginId ?? "",
						privilegeKey: privilege.key,
					});
				} else {
					toDelete.push({
						userUuid: user.uuid,
						pluginId: privilege.pluginId ?? "",
						privilegeKey: privilege.key,
					});
				}
			}

			await entityManager.delete(DBPrivilege, toDelete);
			await entityManager.upsert(DBPrivilege, toAdd, {
				conflictPaths: ["userUuid", "privilegeKey", "pluginId"],
				skipUpdateIfNoValuesChanged: true,
			});
		});
	}

	toPrivilegeList(
		userUuid: string,
		privileges: DBPrivilege[],
	): PrivilegeResponse[] {
		const isAdmin = this.isAdmin(userUuid);
		const output: PrivilegeResponse[] = [
			{
				pluginId: null,
				key: "*",
				includedIn: [],
				granted:
					isAdmin ||
					privileges.some((p) => !p.pluginId && p.privilegeKey == "*"),
				grantedByInclusion: false,
			},
		];

		const grantedIds = privileges.map(
			({ privilegeKey, pluginId }) => `${pluginId}:${privilegeKey}`,
		);

		const systemPrivileges = this.allSystemPrivileges();
		for (const { key, includedIn } of systemPrivileges) {
			output.push({
				pluginId: null,
				key,
				includedIn: Array.from(new Set([...includedIn, "*"])),
				granted: grantedIds.includes(`:${key}`),
				grantedByInclusion: false,
			});
		}

		const getCompositeId = (pluginId: string | null, key: string) =>
			`${pluginId}::${key}`;

		const childMap = new Map<string, string[]>();

		for (const p of output) {
			const childId = getCompositeId(p.pluginId, p.key);

			for (const parentKey of p.includedIn) {
				const parentId = getCompositeId(p.pluginId, parentKey);

				if (!childMap.has(parentId)) {
					childMap.set(parentId, []);
				}
				childMap.get(parentId)!.push(childId);
			}
		}

		const queue: string[] = output
			.filter((p) => p.granted)
			.map((p) => getCompositeId(p.pluginId, p.key));

		const grantedByInclusionSet = new Set<string>();

		while (queue.length > 0) {
			const currentId = queue.shift()!;
			const children = childMap.get(currentId) || [];

			for (const childId of children) {
				if (!grantedByInclusionSet.has(childId)) {
					grantedByInclusionSet.add(childId);
					queue.push(childId);
				}
			}
		}

		return output.map((p) => ({
			...p,
			grantedByInclusion: grantedByInclusionSet.has(
				getCompositeId(p.pluginId, p.key),
			),
		}));
	}
}
