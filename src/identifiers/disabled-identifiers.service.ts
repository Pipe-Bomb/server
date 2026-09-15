import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { FindOptionsWhere, Repository } from "typeorm";
import { DBDisabledIdentifier } from "./entities/disabled-identifier.entity";
import { IdentifierKeyDto } from "./dto/identifier-key.dto";

@Injectable()
export class DisabledIdentifiersService {
	constructor(
		@InjectRepository(DBDisabledIdentifier)
		private readonly repository: Repository<DBDisabledIdentifier>,
	) {}

	public async getDisabledSet(): Promise<Set<string>> {
		const rows = await this.repository.find();
		return new Set(
			rows.map((r) => `${r.pluginId}:${r.identifierId}:${r.type}`),
		);
	}

	public async disableIdentifiers(items: IdentifierKeyDto[]): Promise<void> {
		if (!items.length) {
			return;
		}
		await this.repository.upsert(items, {
			conflictPaths: ["pluginId", "identifierId", "type"],
			skipUpdateIfNoValuesChanged: true,
		});
	}

	public async enableIdentifiers(items: IdentifierKeyDto[]): Promise<void> {
		if (!items.length) {
			return;
		}
		const conditions: FindOptionsWhere<DBDisabledIdentifier>[] = items.map(
			(item) => ({
				pluginId: item.pluginId,
				identifierId: item.identifierId,
				type: item.type,
			}),
		);
		await this.repository.delete(conditions);
	}
}
