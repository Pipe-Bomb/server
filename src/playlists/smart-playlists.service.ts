import {
	BadRequestException,
	Injectable,
	Logger,
	NotFoundException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { DBSmartPlaylistFilter } from "./entity/smart-playlist-filter.entity";
import { Equal, FindOptionsWhere, In, IsNull, Not, Repository } from "typeorm";
import { DBPlaylist } from "./entity/playlist.entity";
import { SmartFilterDto } from "./dto/create-smart-filter.dto";
import { DBSmartPlaylistFilterGroup } from "./entity/smart-playlist-filter-group.entity";
import { AttributeType } from "src/attributes/enum/attribute-type.enum";
import { TrackManagerService } from "src/track-manager/track-manager.service";
import { DBPlaylistTrack } from "./entity/playlist-track.entity";
import { PlaylistsService } from "./playlists.service";
import { WorkflowsService } from "src/workflows/workflows.service";
import { TasksService } from "src/tasks/tasks.service";
import { EventEmitter2 } from "@nestjs/event-emitter";
import { emitServerEvent } from "src/util/emitter.util";

@Injectable()
export class SmartPlaylistsService {
	private readonly logger = new Logger("Smart Playlists Service");

	constructor(
		@InjectRepository(DBPlaylist)
		private readonly playlistsRepository: Repository<DBPlaylist>,
		@InjectRepository(DBSmartPlaylistFilterGroup)
		private readonly smartPlaylistFilterGroupsRepository: Repository<DBSmartPlaylistFilterGroup>,
		@InjectRepository(DBSmartPlaylistFilter)
		private readonly smartPlaylistFiltersRepository: Repository<DBSmartPlaylistFilter>,
		@InjectRepository(DBPlaylistTrack)
		private readonly playlistTracksRepository: Repository<DBPlaylistTrack>,
		private readonly playlistsService: PlaylistsService,
		private readonly trackManagerService: TrackManagerService,
		private readonly tasksService: TasksService,
		private readonly emitter: EventEmitter2,
	) {
		this.tasksService.registerSystemTask({
			id: "scan-smart-filters",
			resumable: true,
			run: async (ctx) => {
				const criteria: FindOptionsWhere<DBPlaylist>[] = [
					{
						lastSmartFilterScanRunId: IsNull(),
					},
					{
						lastSmartFilterScanRunId: Not(Equal(ctx.getRunId())),
					},
				];

				const count = await this.playlistsRepository.count({
					where: criteria,
				});

				let total = 0;
				while (true) {
					const playlists = await this.playlistsRepository.find({
						where: criteria,
						take: 1_000,
					});

					if (!playlists.length) {
						return;
					}

					for (const playlist of playlists) {
						await this.runFilters(playlist);
						ctx.update(++total / count);
					}

					await this.playlistsRepository.update(
						{
							uuid: In(playlists.map(({ uuid }) => uuid)),
						},
						{
							lastSmartFilterScanRunId: ctx.getRunId(),
						},
					);
				}
			},
		});
	}

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

		emitServerEvent(this.emitter, "playlist.filters.updated", playlist);
	}

	async updateFilterGroup(
		filterGroupUuid: string,
		playlist: DBPlaylist,
		filters: SmartFilterDto[],
	) {
		const filterEntities = filters.map((filter) => this.toDBFilter(filter));

		const group = await this.smartPlaylistFilterGroupsRepository.findOneBy({
			uuid: filterGroupUuid,
		});

		if (!group) {
			throw new NotFoundException("Filter group not found");
		}

		if (group.playlistUuid != playlist.uuid) {
			throw new BadRequestException("Group is not a part of playlist");
		}

		const before = await this.filterGroupSignature(group.uuid);

		await this.smartPlaylistFiltersRepository.delete({
			groupUuid: group.uuid,
		});

		for (const entity of filterEntities) {
			entity.groupUuid = group.uuid;
		}

		await this.smartPlaylistFiltersRepository.insert(filterEntities);

		const after = await this.filterGroupSignature(group.uuid);
		if (before !== after) {
			emitServerEvent(this.emitter, "playlist.filters.updated", playlist);
		}
	}

	async deleteFilterGroup(filterGroupUuid: string, playlist: DBPlaylist) {
		const group = await this.smartPlaylistFilterGroupsRepository.findOneBy({
			uuid: filterGroupUuid,
		});

		if (!group) {
			throw new NotFoundException("Filter group not found");
		}

		if (group.playlistUuid != playlist.uuid) {
			throw new BadRequestException("Group is not a part of playlist");
		}

		await this.smartPlaylistFilterGroupsRepository.delete({
			uuid: group.uuid,
		});

		emitServerEvent(this.emitter, "playlist.filters.updated", playlist);
	}

	private async filterGroupSignature(groupUuid: string): Promise<string> {
		const filters = await this.smartPlaylistFiltersRepository.findBy({
			groupUuid,
		});

		return filters
			.map(
				(filter) =>
					`${filter.entityType}:${filter.attributeKey}:${filter.attributeType}:${filter.inverse}:${filter.value_string}:${filter.value_int}:${filter.value_decimal}:${filter.value_boolean}:${filter.min}:${filter.max}:${filter.partial}`,
			)
			.sort()
			.join("|");
	}

	async runFilters(playlist: DBPlaylist) {
		const groups = await this.smartPlaylistFilterGroupsRepository.find({
			where: {
				playlistUuid: playlist.uuid,
			},
			relations: {
				filters: true,
			},
		});

		const trackIds =
			await this.trackManagerService.findTracksBySmartFilters(groups);

		const existingTracks = (
			await this.playlistTracksRepository.find({
				where: {
					playlistUuid: playlist.uuid,
					addedByUuid: IsNull(),
				},
				select: ["trackUuid"],
			})
		).map((track) => track.trackUuid);

		const toRemove: string[] = [];
		for (const trackId of existingTracks) {
			if (!trackIds.includes(trackId)) {
				toRemove.push(trackId);
			}
		}

		this.logger.log(
			`Removing ${toRemove.length} tracks from "${playlist.uuid}"...`,
		);
		for (let i = 0; i < toRemove.length; i += 500) {
			await this.playlistsService.removeTracks(
				playlist,
				toRemove.slice(i, i + 500),
			);
		}

		const toAdd = trackIds.filter(
			(trackId) => !existingTracks.includes(trackId),
		);

		this.logger.log(`Adding ${toAdd.length} tracks from "${playlist.uuid}"...`);
		for (let i = 0; i < toAdd.length; i += 500) {
			await this.playlistsService.addTracks(
				playlist,
				toAdd.slice(i, i + 500),
				null,
			);
		}
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
