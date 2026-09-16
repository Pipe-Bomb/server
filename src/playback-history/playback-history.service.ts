import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { DBPlaybackHistoryEntry } from "./entity/playback-history-entry.entity";
import { FindOptionsWhere, IsNull, Repository } from "typeorm";
import { PlaybackHistoryClient } from "sdk/playback-history";
import { LoadedPlugin } from "src/plugins/interface/loaded-plugin.interface";

@Injectable()
export class PlaybackHistoryService {
	constructor(
		@InjectRepository(DBPlaybackHistoryEntry)
		private readonly playbackHistoryEntryRepository: Repository<DBPlaybackHistoryEntry>,
	) {}

	async addHistoryEntry(
		trackUuid: string,
		userUuid: string,
		pluginId: string | null,
		clientName: string,
		datePlayed: Date,
	) {
		await this.playbackHistoryEntryRepository
			.createQueryBuilder()
			.insert()
			.into(DBPlaybackHistoryEntry)
			.values({
				trackUuid,
				userUuid,
				pluginId,
				clientName,
				datePlayed: datePlayed.getTime(),
			})
			.orIgnore()
			.execute();
	}

	async getUserHistory(
		userUuid: string,
		options: {
			amount: number;
			offset: number;
			pluginId?: string | null;
			clientName?: string;
		},
	) {
		const where: FindOptionsWhere<DBPlaybackHistoryEntry> = {
			userUuid,
		};

		if (options.pluginId) {
			where.pluginId = options.pluginId;
		} else if (options.pluginId === null) {
			where.pluginId = IsNull();
		}

		if (options.clientName) {
			where.clientName = options.clientName;
		}

		const [entries, total] =
			await this.playbackHistoryEntryRepository.findAndCount({
				where,
				order: {
					datePlayed: "desc",
				},
				take: options.amount,
				skip: options.offset,
			});

		return {
			entries,
			total,
		};
	}

	createClient(plugin: LoadedPlugin): PlaybackHistoryClient {
		return {
			addHistoryEntry: (trackUuid, userUuid, clientName, datePlayed) =>
				this.addHistoryEntry(
					trackUuid,
					userUuid,
					plugin.package.name,
					clientName,
					datePlayed,
				),
			getUserHistory: (userUuid, options) =>
				this.getUserHistory(userUuid, {
					amount: options.amount,
					offset: options.offset ?? 0,
					pluginId: options.pluginId,
					clientName: options.clientName,
				}).then(({ entries, total }) => ({
					entries: entries.map((entry) => ({
						userUuid: entry.userUuid,
						trackUuid: entry.trackUuid,
						pluginId: entry.pluginId,
						clientName: entry.clientName,
						datePlayed: new Date(entry.datePlayed),
						dateRecorded: new Date(entry.dateRecorded),
					})),
					total,
				})),
		};
	}
}
