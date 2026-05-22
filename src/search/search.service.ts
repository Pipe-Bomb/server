import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { AlbumManagerService } from "src/album-manager/album-manager.service";
import { DBAlbum } from "src/albums/entity/album.entity";
import { DBArtist } from "src/artist-manager/entity/artist.entity";
import { DBAttributeTemplate } from "src/attributes/entities/attribute.entity-template";
import { TrackManagerService } from "src/track-manager/track-manager.service";
import { DBTrack } from "src/tracks/entities/track.entity";
import { FindOptionsWhere, ILike, Repository } from "typeorm";

@Injectable()
export class SearchService {
	constructor(
		private readonly trackManagerService: TrackManagerService,
		@InjectRepository(DBArtist)
		private readonly artistsRepository: Repository<DBArtist>,
		private readonly albumManagerService: AlbumManagerService,
	) {}

	async search(options: {
		query?: string;
		trackAmount: number;
		artistAmount: number;
		albumAmount: number;
	}) {
		const attributeWhere: FindOptionsWhere<DBAttributeTemplate> = {};

		if (options.query) {
			attributeWhere.value_string = ILike(`%${options.query}%`);
		}

		let tracks: DBTrack[] = [];

		if (options.trackAmount) {
			tracks = await this.trackManagerService.find({
				where: {
					attributes: attributeWhere,
				},
				relationLoadStrategy: "query",
				relations: {
					attributes: true,
					artists: {
						artist: {
							attributes: true,
						},
					},
					albums: {
						album: {
							attributes: true,
						},
					},
				},
				take: options.trackAmount,
			});
		}

		let artists: DBArtist[] = [];
		if (options.artistAmount) {
			artists = await this.artistsRepository.find({
				where: {
					attributes: attributeWhere,
				},
				relationLoadStrategy: "query",
				relations: {
					attributes: true,
				},
				take: options.artistAmount,
			});
		}

		let albums: DBAlbum[] = [];
		if (options.albumAmount) {
			albums = await this.albumManagerService.findMany({
				where: {
					attributes: attributeWhere,
				},
				withArtists: true,
				withAttributes: true,
				amount: options.albumAmount,
			});
		}

		return {
			tracks,
			artists,
			albums,
		};
	}
}
