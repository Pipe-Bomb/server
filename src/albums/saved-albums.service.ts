import {
	BadRequestException,
	Injectable,
	Logger,
	NotFoundException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { DBSavedAlbum } from "./entity/saved-album.entity";
import { Repository } from "typeorm";
import { DBAlbum } from "./entity/album.entity";
import { DBUser } from "src/users/entity/user.entity";
import { EphemeralService } from "src/ephemeral/ephemeral.service";
import { LibrariesService } from "src/libraries/libraries.service";
import { AlbumManagerService } from "src/album-manager/album-manager.service";
import { AlbumsService } from "./albums.service";
import { TrackId } from "src/tracks/interface/track-id.interface";
import { DBTrack } from "src/tracks/entities/track.entity";

@Injectable()
export class SavedAlbumsService {
	private readonly logger = new Logger("Saved Albums Service");

	constructor(
		@InjectRepository(DBSavedAlbum)
		private readonly savedAlbumsRepository: Repository<DBSavedAlbum>,
		private readonly ephemeralService: EphemeralService,
		private readonly librariesService: LibrariesService,
		private readonly albumManagerService: AlbumManagerService,
		private readonly albumsService: AlbumsService,
	) {}

	async saveAlbum(album: DBAlbum, user: DBUser) {
		await this.savedAlbumsRepository.upsert(
			{
				albumUuid: album.uuid,
				userUuid: user.uuid,
			},
			["albumUuid", "userUuid"],
		);
	}

	async unsaveAlbum(album: DBAlbum, user: DBUser) {
		const entry = await this.savedAlbumsRepository.findOneBy({
			albumUuid: album.uuid,
			userUuid: user.uuid,
		});
		if (!entry) {
			throw new BadRequestException("Album isn't saved");
		}
		await this.savedAlbumsRepository.delete({
			albumUuid: album.uuid,
			userUuid: user.uuid,
		});
	}

	async getSavedAlbums(
		user: DBUser | null,
		options: {
			amount: number;
			offset?: number;
			withAlbums?: boolean;
			withAttributes?: boolean;
			withIdentities?: boolean;
			withArtists?: boolean;
		},
	) {
		const [albums, total] = await this.savedAlbumsRepository.findAndCount({
			where: user
				? {
						userUuid: user.uuid,
					}
				: {},
			order: {
				dateAdded: "DESC",
			},
			take: options.amount,
			skip: options.offset,
			relationLoadStrategy: "query",
			relations: {
				album: options.withAlbums && {
					attributes: options.withAttributes,
					identities: options.withIdentities,
					artists: !!options.withArtists && {
						artist: {
							attributes: true,
						},
					},
				},
			},
		});

		return {
			albums,
			total,
		};
	}

	async saveEphemeralAlbum(
		pluginId: string,
		identifierId: string,
		identity: string,
		user: DBUser,
	) {
		const source = this.ephemeralService.getEphemeralSourceByAlbumIdentity(
			pluginId,
			identifierId,
		);

		if (!source) {
			throw new NotFoundException("Source does not exist");
		}

		const content = await this.ephemeralService.getEphemeralAlbumContent(
			source,
			identifierId,
			identity,
		);

		if (!content?.tracks?.length) {
			throw new BadRequestException("Album is not handled by Source");
		}

		const albumUuid = await this.albumManagerService.resolveAlbum(
			pluginId,
			identifierId,
			identity,
			true,
		);

		const found = await this.ephemeralService.createAlbumArtistsAndAttributes(
			pluginId,
			identifierId,
			identity,
			albumUuid,
		);

		if (!found) {
			throw new NotFoundException("Album not found");
		}

		const trackIds: TrackId[] = content.tracks.map((track) => ({
			pluginId: track.pluginId,
			libraryId: track.libraryId,
			trackId: track.trackId,
		}));

		const resolved = await this.librariesService.resolveTracks(trackIds);
		const missingIndexes = trackIds
			.map((track, index) => ({ track, index }))
			.filter(({ index }) => !resolved[index]);
		const missingTracks = missingIndexes.map(({ track }) => track);

		const session = await this.ephemeralService.createTracks(missingTracks, {
			userUuid: user.uuid,
		});

		session.promise
			.then(async (createdTracks: (DBTrack | null)[]) => {
				const allTracks: (DBTrack | null)[] = Array(trackIds.length).fill(null);

				for (let i = 0; i < resolved.length; i++) {
					if (resolved[i]) allTracks[i] = resolved[i];
				}
				for (let i = 0; i < missingIndexes.length; i++) {
					if (createdTracks[i]) {
						allTracks[missingIndexes[i].index] = createdTracks[i];
					}
				}

				for (const track of allTracks) {
					if (track) {
						await this.albumManagerService.setTrackLinks(
							track,
							[albumUuid],
							pluginId,
							identifierId,
						);
					}
				}

				await this.savedAlbumsRepository.upsert(
					{ albumUuid, userUuid: user.uuid },
					["albumUuid", "userUuid"],
				);
			})
			.catch((e: unknown) => {
				this.logger.error("Failed to save ephemeral album", e);
			});

		return session;
	}
}
