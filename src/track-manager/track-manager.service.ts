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
} from "typeorm";

@Injectable()
export class TrackManagerService {
	private readonly logger = new Logger("Track Manager Service");

	constructor(
		@InjectRepository(DBTrack)
		private readonly tracksRepository: Repository<DBTrack>,
	) {}

	find(options: FindManyOptions<DBTrack>) {
		return this.tracksRepository.find(options);
	}

	count(where: FindOptionsWhere<DBTrack>) {
		return this.tracksRepository.count({ where });
	}

	findOne(options: FindOneOptions<DBTrack>) {
		return this.tracksRepository.findOne(options);
	}

	async addTrack(
		plugin: LoadedPlugin,
		libraryHandler: LibraryHandler,
		track: Track,
	) {
		const dbTrack = await this.tracksRepository.findOneBy({
			pluginId: plugin.package.name,
			libraryId: libraryHandler.id,
			trackId: track.id,
		});

		if (!dbTrack) {
			const dbTrack = this.tracksRepository.create({
				pluginId: plugin.package.name,
				libraryId: libraryHandler.id,
				trackId: track.id,
				title: track.title,
			});
			await this.tracksRepository.insert(dbTrack);
			this.logger.debug(
				`Added new Track "${track.id}" in Library "${libraryHandler.id}" for Plugin "${plugin.package.name}"`,
			);
			return;
		}
	}
}
