import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { DBAlbumArtist } from "src/albums/entity/album-artist.entity";
import { DBAlbum } from "src/albums/entity/album.entity";
import { DBArtist } from "src/artists/entity/artist.entity";
import { DeepPartial, FindOptionsWhere, In, Repository } from "typeorm";

@Injectable()
export class AlbumManagerService {
	constructor(
		@InjectRepository(DBAlbum)
		private readonly albumsRepository: Repository<DBAlbum>,
		@InjectRepository(DBAlbumArtist)
		private readonly albumArtistsRepository: Repository<DBAlbumArtist>,
	) {}

	count(where: FindOptionsWhere<DBAlbum> | FindOptionsWhere<DBAlbum>[]) {
		return this.albumsRepository.countBy(where);
	}

	findMany(options: {
		amount: number;
		offset?: number;
		withAttributes?: boolean;
		withIdentities?: boolean;
		withArtists?: boolean;
		where?: FindOptionsWhere<DBAlbum> | FindOptionsWhere<DBAlbum>[];
	}) {
		return this.albumsRepository.find({
			where: options.where,
			take: options.amount,
			skip: options.offset,
			relations: {
				attributes: options.withAttributes,
				identities: options.withIdentities,
				artists: !!options.withArtists && {
					artist: {
						attributes: true,
					},
				},
			},
		});
	}

	async findForArtist(
		artist: DBArtist,
		options: {
			amount: number;
			withAttributes?: boolean;
			withArtists?: boolean;
		},
	) {
		const albums = await this.albumsRepository.find({
			where: {
				artists: {
					artistUuid: artist.uuid,
				},
			},
			select: ["uuid"],
		});

		const albumArtists = await this.albumArtistsRepository.find({
			where: {
				artistUuid: artist.uuid,
				albumUuid: In(albums.map((album) => album.uuid)),
			},
			relations: {
				album: {
					attributes: options.withAttributes,
					artists: options.withArtists && {
						artist: {
							attributes: true,
						},
					},
				},
			},
		});

		const uniqueMap = new Map<string, DBAlbumArtist>();

		for (const albumArtist of albumArtists) {
			if (!uniqueMap.has(albumArtist.albumUuid)) {
				uniqueMap.set(albumArtist.albumUuid, albumArtist);
			}
		}

		return Array.from(uniqueMap.values());
	}

	async findOne(
		uuid: string,
		options: {
			withAttributes?: boolean;
			withIdentities?: boolean;
			withArtists?: boolean;
			withTracks?: boolean;
			withTrackAttributes?: boolean;
			withTrackArtists?: boolean;
		} = {},
	) {
		const album = await this.albumsRepository.findOne({
			where: {
				uuid,
			},
			relations: {
				attributes: options.withAttributes,
				identities: options.withIdentities,
				artists: !!options.withArtists && {
					artist: {
						attributes: true,
					},
				},
				tracks: !!options.withTracks && {
					track: {
						artists: {
							artist: {
								attributes: true,
							},
						},
						attributes: options.withTrackAttributes,
					},
				},
			},
		});

		return album;
	}

	async setRunId(album: DBAlbum, runId: string, type: "identity") {
		const partial: Record<typeof type, DeepPartial<DBAlbum>> = {
			identity: {
				lastIdentificationRunId: runId,
			},
		};

		await this.albumsRepository.update({ uuid: album.uuid }, partial[type]);
	}
}
