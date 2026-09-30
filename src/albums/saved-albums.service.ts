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
		const [albums, count] = await this.savedAlbumsRepository.findAndCount({
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
			count,
		};
	}

	async saveEphemeralAlbum(
		pluginId: string,
		identifierId: string,
		identity: string,
	) {
		const source = this.ephemeralService.getEphemeralSourceByAlbumIdentity(
			pluginId,
			identifierId,
		);

		if (!source) {
			throw new NotFoundException("Source does not exist");
		}

		const ephemeralAlbum = await this.ephemeralService.resolveEphemeralAlbum(
			pluginId,
			identifierId,
			identity,
		);

		if (!ephemeralAlbum) {
			throw new NotFoundException("Album not found");
		}

		const content = await this.ephemeralService.getEphemeralAlbumContent(
			source,
			identifierId,
			identity,
		);

		if (!content?.tracks) {
			throw new BadRequestException("Album is not handled by Source");
		}

		if (content.tracks) {
			// const resolved = await this.librariesService.resolveTracks(
			// 	content.tracks,
			// );
			// const missingIndexes = content.tracks
			// 	.map((track, index) => ({ track, index }))
			// 	.filter(({ index }) => !resolved[index]);
			// this.ephemeralService.createTracks(track);
			// const session = await this.ephemeralService.createTracks(
			// 	missingIndexes.map((index) => index.track),
			// );
			// for (const track of content.tracks) {
			// }
		}

		const albumId = await this.albumManagerService.resolveAlbum(
			pluginId,
			identifierId,
			identity,
			true,
		);

		const album = await this.albumManagerService.findOne(albumId);
	}
}
