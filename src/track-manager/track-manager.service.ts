import { Injectable, Logger } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { LibraryHandler, Track } from "@sdk";
import { LoadedPlugin } from "src/plugins/interface/loaded-plugin.interface";
import { DBTrack } from "src/tracks/entities/track.entity";
import {
	Repository,
	FindManyOptions,
	FindOptionsWhere,
	FindOneOptions,
	In,
	QueryDeepPartialEntity,
} from "typeorm";

@Injectable()
export class TrackManagerService {
	private readonly logger = new Logger("Track Manager Service");

	constructor(
		@InjectRepository(DBTrack)
		private readonly tracksRepository: Repository<DBTrack>,
	) {}

	queryBuilder(alias?: string) {
		return this.tracksRepository.createQueryBuilder(alias);
	}

	find(options: FindManyOptions<DBTrack>) {
		return this.tracksRepository.find(options);
	}

	count(where: FindOptionsWhere<DBTrack> | FindOptionsWhere<DBTrack>[]) {
		return this.tracksRepository.countBy(where);
	}

	findOne(options: FindOneOptions<DBTrack>) {
		return this.tracksRepository.findOne(options);
	}

	async deleteAll() {
		await this.tracksRepository.deleteAll();
	}

	async setRunId(
		tracks: DBTrack[],
		runId: string,
		type: "attribute" | "identity",
	) {
		const partial: QueryDeepPartialEntity<DBTrack> = (() => {
			switch (type) {
				case "attribute":
					return {
						lastAttributionRunId: runId,
					};
				case "identity":
					return {
						lastIdentificationRunId: runId,
					};
			}
		})();

		await this.tracksRepository.update(
			{
				uuid: In(tracks.map((track) => track.uuid)),
			},
			partial,
		);
	}

	async addTrack(
		plugin: LoadedPlugin,
		libraryHandler: LibraryHandler,
		track: Track,
		runId: string | null,
	) {
		if (runId) {
			await this.tracksRepository.upsert(
				{
					pluginId: plugin.package.name,
					libraryId: libraryHandler.id,
					trackId: track.id,
					title: track.title,
					lastScanRunId: runId,
				},
				{
					conflictPaths: ["pluginId", "libraryId", "trackId"],
					skipUpdateIfNoValuesChanged: true,
				},
			);
		} else {
			await this.tracksRepository.upsert(
				{
					pluginId: plugin.package.name,
					libraryId: libraryHandler.id,
					trackId: track.id,
					title: track.title,
					lastScanRunId: null,
				},
				["pluginId", "libraryId", "trackId"],
			);
		}
	}

	async removeTracks(
		plugin: LoadedPlugin,
		libraryHandler: LibraryHandler,
		trackIds: string[],
	) {
		const chunks: string[][] = [];
		for (let i = 0; i * 1000 < trackIds.length; i++) {
			chunks.push(trackIds.slice(i * 1000, (i + 1) * 1000));
		}

		for (const chunk of chunks) {
			await this.tracksRepository.delete({
				pluginId: plugin.package.name,
				libraryId: libraryHandler.id,
				trackId: In(chunk),
			});
		}
	}

	async addTracks(
		plugin: LoadedPlugin,
		libraryHandler: LibraryHandler,
		tracks: Track[],
	) {
		const ids = tracks.map((track) => track.id);
		const output: (DBTrack | null)[] = Array(tracks.length).fill(null);

		const existingTracks = await this.tracksRepository.find({
			where: {
				pluginId: plugin.package.name,
				libraryId: libraryHandler.id,
				trackId: In(ids),
			},
		});
		const existingIds = existingTracks.map((track) => track.trackId);
		for (const track of existingTracks) {
			const index = ids.indexOf(track.trackId);
			if (index < 0) {
				throw new Error("Invalid track returned");
			}
			output[index] = track;
		}

		const toInsert = this.tracksRepository.create(
			tracks
				.filter((track) => !existingIds.includes(track.id))
				.map((track) => ({
					pluginId: plugin.package.name,
					libraryId: libraryHandler.id,
					trackId: track.id,
					title: track.title,
				})),
		);

		if (toInsert.length) {
			for (const track of toInsert) {
				const index = ids.indexOf(track.trackId);
				if (index < 0) {
					throw new Error("Invalid track created");
				}
				output[index] = track;
			}
			await this.tracksRepository.insert(toInsert);
			this.logger.debug(
				`Added ${toInsert.length} new Tracks to Library "${libraryHandler.id}" for Plugin "${plugin.package.name}"`,
			);
		}

		return output as DBTrack[];
	}
}
