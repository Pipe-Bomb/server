import {
	BadRequestException,
	Injectable,
	Logger,
	NotFoundException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { DBSavedTrack } from "./entities/saved-track.entity";
import { Repository } from "typeorm";
import { DBTrack } from "./entities/track.entity";
import { DBUser } from "src/users/entity/user.entity";
import { TrackManagerService } from "src/track-manager/track-manager.service";
import { EphemeralService } from "src/ephemeral/ephemeral.service";

@Injectable()
export class SavedTracksService {
	private readonly logger = new Logger("Saved Tracks Service");

	constructor(
		@InjectRepository(DBSavedTrack)
		private readonly savedTracksRepository: Repository<DBSavedTrack>,
		private readonly trackManagerService: TrackManagerService,
		private readonly ephemeralService: EphemeralService,
	) {}

	async saveTrack(track: DBTrack, user: DBUser) {
		await this.savedTracksRepository.upsert(
			{
				trackUuid: track.uuid,
				userUuid: user.uuid,
			},
			["trackUuid", "userUuid"],
		);
	}

	async unsaveTrack(track: DBTrack, user: DBUser) {
		const entry = await this.savedTracksRepository.findOneBy({
			trackUuid: track.uuid,
			userUuid: user.uuid,
		});
		if (!entry) {
			throw new BadRequestException("Track isn't saved");
		}
		await this.savedTracksRepository.delete({
			trackUuid: track.uuid,
			userUuid: user.uuid,
		});
	}

	async getSavedTracks(
		user: DBUser | null,
		options: {
			amount: number;
			offset?: number;
			withAttributes?: boolean;
			withIdentities?: boolean;
			withArtists?: boolean;
			withAlbums?: boolean;
		},
	) {
		const [tracks, total] =
			await this.savedTracksRepository.findAndCount({
				where: user ? { userUuid: user.uuid } : {},
				order: {
					dateAdded: "DESC",
				},
				take: options.amount,
				skip: options.offset,
				relations: {
					track: {
						attributes: options.withAttributes,
						identities: options.withIdentities,
						artists: !!options.withArtists && {
							artist: {
								attributes: true,
							},
						},
						albums: !!options.withAlbums && {
							album: {
								attributes: true,
							},
						},
					},
				},
			});

		return {
			tracks,
			total,
		};
	}

	async saveEphemeralTrack(
		pluginId: string,
		libraryId: string,
		trackId: string,
		user: DBUser,
	): Promise<string | null> {
		const existing = await this.trackManagerService.findOne({
			where: { pluginId, libraryId, trackId },
		});

		if (existing) {
			await this.saveTrack(existing, user);
			return null;
		}

		const source = this.ephemeralService.find(pluginId, libraryId);
		if (!source) {
			throw new NotFoundException("Source does not exist");
		}

		const session = await this.ephemeralService.createTracks(
			[{ pluginId, libraryId, trackId }],
			{ userUuid: user.uuid },
		);

		session.promise
			.then(async (tracks: (DBTrack | null)[]) => {
				const track = tracks[0];
				if (track) {
					await this.saveTrack(track, user);
				}
			})
			.catch((e: unknown) => {
				this.logger.error("Failed to save ephemeral track", e);
			});

		return session.uuid;
	}
}
