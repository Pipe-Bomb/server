import {
	BadRequestException,
	Injectable,
	Logger,
	NotFoundException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { DBSavedArtist } from "./entity/saved-artist.entity";
import { Repository } from "typeorm";
import { DBArtist } from "src/artist-manager/entity/artist.entity";
import { DBUser } from "src/users/entity/user.entity";
import { ArtistManagerService } from "src/artist-manager/artist-manager.service";
import { ArtistIdentityTarget } from "src/artist-manager/enum/artist-identity-target.enum";

@Injectable()
export class SavedArtistsService {
	private readonly logger = new Logger("Saved Artists Service");

	constructor(
		@InjectRepository(DBSavedArtist)
		private readonly savedArtistsRepository: Repository<DBSavedArtist>,
		private readonly artistManagerService: ArtistManagerService,
	) {}

	async saveArtist(artist: DBArtist, user: DBUser) {
		await this.savedArtistsRepository.upsert(
			{
				artistUuid: artist.uuid,
				userUuid: user.uuid,
			},
			["artistUuid", "userUuid"],
		);
	}

	async unsaveArtist(artist: DBArtist, user: DBUser) {
		const entry = await this.savedArtistsRepository.findOneBy({
			artistUuid: artist.uuid,
			userUuid: user.uuid,
		});
		if (!entry) {
			throw new BadRequestException("Artist isn't saved");
		}
		await this.savedArtistsRepository.delete({
			artistUuid: artist.uuid,
			userUuid: user.uuid,
		});
	}

	async getSavedArtists(
		user: DBUser | null,
		options: {
			amount: number;
			offset?: number;
			withAttributes?: boolean;
			withIdentities?: boolean;
		},
	) {
		const [artists, total] =
			await this.savedArtistsRepository.findAndCount({
				where: user ? { userUuid: user.uuid } : {},
				order: {
					dateAdded: "DESC",
				},
				take: options.amount,
				skip: options.offset,
				relations: {
					artist: {
						attributes: options.withAttributes,
						identities: options.withIdentities,
					},
				},
			});

		return {
			artists,
			total,
		};
	}

	async saveEphemeralArtist(
		pluginId: string,
		identifierId: string,
		identity: string,
		user: DBUser,
	) {
		const artistUuid = await this.artistManagerService.resolveArtist(
			pluginId,
			identifierId,
			identity,
			ArtistIdentityTarget.ARTIST,
			true,
		);

		const artist = await this.artistManagerService.findOne(artistUuid);
		if (!artist) {
			throw new NotFoundException("Artist not found");
		}

		await this.saveArtist(artist, user);
	}
}
