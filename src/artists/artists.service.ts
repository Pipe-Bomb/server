import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { DBArtist } from "./entity/artist.entity";
import { DataSource, Repository } from "typeorm";
import { DBArtistIdentity } from "./entity/artist-identity.entity";
import { DBTrackArtist } from "./entity/track-artist.entity";
import { DBTrack } from "src/tracks/entities/track.entity";

@Injectable()
export class ArtistsService {
	constructor(
		@InjectRepository(DBArtist)
		private readonly artistsRepository: Repository<DBArtist>,
		@InjectRepository(DBArtistIdentity)
		private readonly identitiesRepository: Repository<DBArtistIdentity>,
		@InjectRepository(DBTrackArtist)
		private readonly trackArtistsRepository: Repository<DBTrackArtist>,
		private readonly dataSource: DataSource,
	) {}

	async setJoinPhrase(
		trackUuid: string,
		artistUuid: string,
		joinPhrase: string | null,
	) {
		await this.trackArtistsRepository.update(
			{
				trackUuid,
				artistUuid,
			},
			{
				joinPhrase,
			},
		);
	}

	async resolveArtist(
		pluginId: string,
		identifierId: string,
		identityValue: string,
		createIfMissing?: false,
	): Promise<string | null>;
	async resolveArtist(
		pluginId: string,
		identifierId: string,
		identityValue: string,
		createIfMissing: true,
	): Promise<string>;
	async resolveArtist(
		pluginId: string,
		identifierId: string,
		identityValue: string,
		createIfMissing: boolean = false,
	): Promise<string | null> {
		const existingIdentity = await this.identitiesRepository.findOne({
			where: { pluginId, identifierId, identity: identityValue },
			select: ["artistUuid"],
		});

		if (existingIdentity) {
			return existingIdentity.artistUuid;
		}

		if (!createIfMissing) {
			return null;
		}

		return await this.dataSource.transaction(async (manager) => {
			const newArtist = manager.create(DBArtist);
			const savedArtist = await manager.save(newArtist);

			const newIdentity = manager.create(DBArtistIdentity, {
				artistUuid: savedArtist.uuid,
				pluginId,
				identifierId,
				identity: identityValue,
				ordinal: 0,
			});
			await manager.save(newIdentity);

			return savedArtist.uuid;
		});
	}

	async clearTrackLinks(
		track: DBTrack,
		pluginId: string,
		identifierId: string,
	) {
		await this.trackArtistsRepository.delete({
			trackUuid: track.uuid,
			pluginId,
			identifierId,
		});
	}

	async setTrackLinks(
		track: DBTrack,
		artistUuids: string[],
		pluginId: string,
		identifierId: string,
	) {
		await this.clearTrackLinks(track, pluginId, identifierId);
		await this.trackArtistsRepository.insert(
			artistUuids.map((artistUuid, ordinal) => ({
				trackUuid: track.uuid,
				artistUuid,
				pluginId,
				identifierId,
				ordinal,
			})),
		);
	}

	findOne(
		uuid: string,
		options: {
			withAttributes?: boolean;
			withIdentities?: boolean;
			withTracks?: boolean;
			withTrackAttributes?: boolean;
			withTrackArtists?: boolean;
		} = {},
	) {
		return this.artistsRepository.findOne({
			where: {
				uuid,
			},
			relations: {
				tracks: options.withTracks && {
					track: {
						attributes: options.withTrackAttributes,
						artists: options.withTrackArtists && {
							artist: {
								attributes: true,
							},
						},
					},
				},
				attributes: options.withAttributes,
				identities: options.withIdentities,
			},
		});
	}

	findMany(options: {
		amount: number;
		offset?: number;
		withAttributes?: boolean;
		withIdentities?: boolean;
	}) {
		return this.artistsRepository.find({
			take: options.amount,
			skip: options.offset,
			relations: {
				attributes: options.withAttributes,
				identities: options.withIdentities,
			},
		});
	}
}
