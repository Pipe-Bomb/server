import {
	BadRequestException,
	Injectable,
	NotFoundException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { DBSmartPlaylistFilter } from "./entity/smart-playlist-filter.entity";
import { Repository } from "typeorm";
import { DBPlaylist } from "./entity/playlist.entity";
import { SmartFilterDto } from "./dto/create-smart-filter.dto";
import { DBSmartPlaylistFilterGroup } from "./entity/smart-playlist-filter-group.entity";
import { AttributeType } from "src/attributes/enum/attribute-type.enum";

@Injectable()
export class SmartPlaylistsService {
	constructor(
		@InjectRepository(DBSmartPlaylistFilterGroup)
		private readonly smartPlaylistFilterGroupsRepository: Repository<DBSmartPlaylistFilterGroup>,
		@InjectRepository(DBSmartPlaylistFilter)
		private readonly smartPlaylistFiltersRepository: Repository<DBSmartPlaylistFilter>,
	) {}

	async addFilterGroup(playlist: DBPlaylist, filters: SmartFilterDto[]) {
		const filterEntities = filters.map((filter) => this.toDBFilter(filter));

		const group = this.smartPlaylistFilterGroupsRepository.create({
			playlistUuid: playlist.uuid,
		});

		await this.smartPlaylistFilterGroupsRepository.save(group);

		for (const entity of filterEntities) {
			entity.groupUuid = group.uuid;
		}

		await this.smartPlaylistFiltersRepository.insert(filterEntities);
	}

	async updateFilterGroup(
		filterGroupUuid: string,
		playlistUuid: string,
		filters: SmartFilterDto[],
	) {
		const filterEntities = filters.map((filter) => this.toDBFilter(filter));

		const group = await this.smartPlaylistFilterGroupsRepository.findOneBy({
			uuid: filterGroupUuid,
		});

		if (!group) {
			throw new NotFoundException("Filter group not found");
		}

		if (group.playlistUuid != playlistUuid) {
			throw new BadRequestException("Group is not a part of playlist");
		}

		await this.smartPlaylistFiltersRepository.delete({
			groupUuid: group.uuid,
		});

		for (const entity of filterEntities) {
			entity.groupUuid = group.uuid;
		}

		await this.smartPlaylistFiltersRepository.insert(filterEntities);
	}

	async deleteFilterGroup(filterGroupUuid: string, playlistUuid: string) {
		const group = await this.smartPlaylistFilterGroupsRepository.findOneBy({
			uuid: filterGroupUuid,
		});

		if (!group) {
			throw new NotFoundException("Filter group not found");
		}

		if (group.playlistUuid != playlistUuid) {
			throw new BadRequestException("Group is not a part of playlist");
		}

		await this.smartPlaylistFilterGroupsRepository.delete({
			uuid: group.uuid,
		});
	}

	private toDBFilter(filter: SmartFilterDto) {
		const entity = this.smartPlaylistFiltersRepository.create({
			entityType: filter.entityType,
			attributeKey: filter.attributeKey,
			attributeType: filter.attributeType,
			inverse: !!filter.inverse,
		});

		switch (filter.attributeType) {
			case AttributeType.BOOLEAN: {
				if (filter.value !== undefined) {
					entity.value_boolean = filter.value;
				}
				break;
			}
			case AttributeType.STRING: {
				if (filter.value !== undefined) {
					entity.value_string = filter.value;
				}
				if (filter.partial !== undefined) {
					entity.partial = filter.partial;
				}
				break;
			}
			case AttributeType.INTEGER: {
				if (filter.value !== undefined) {
					entity.value_int = filter.value;
				}
				if (filter.min !== undefined) {
					entity.min = filter.min;
				}
				if (filter.max !== undefined) {
					entity.max = filter.max;
				}
				break;
			}
			case AttributeType.DECIMAL: {
				if (filter.value !== undefined) {
					entity.value_decimal = filter.value;
				}
				if (filter.min !== undefined) {
					entity.min = filter.min;
				}
				if (filter.max !== undefined) {
					entity.max = filter.max;
				}
				break;
			}
			case AttributeType.BUFFER: {
				break;
			}
			default:
				throw new Error("Not implemented");
		}

		return entity;
	}
}
