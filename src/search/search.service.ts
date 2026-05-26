import { BadRequestException, Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { AlbumManagerService } from "src/album-manager/album-manager.service";
import { DBAlbum } from "src/albums/entity/album.entity";
import { DBArtist } from "src/artist-manager/entity/artist.entity";
import { DBAttributeTemplate } from "src/attributes/entities/attribute.entity-template";
import { TrackManagerService } from "src/track-manager/track-manager.service";
import { DBTrack } from "src/tracks/entities/track.entity";
import {
	FindOptionsWhere,
	ILike,
	In,
	Repository,
	SelectQueryBuilder,
} from "typeorm";
import {
	BooleanSearchAttributeDto,
	BufferSearchAttributeDto,
	DecimalSearchAttributeDto,
	IntegerSearchAttributeDto,
	SearchAttributeDto,
	StringSearchAttributeDto,
} from "./dto/search-attribute.dto";
import { AttributeEntity } from "src/attribute-sources/enum/attribute-entity.enum";
import { DBTrackAttribute } from "src/attributes/entities/track-attribute.entity";
import { AttributeType } from "src/attributes/enum/attribute-type.enum";
import { DBArtistAttribute } from "src/attributes/entities/artist-attribute.entity";
import { DBAlbumAttribute } from "src/attributes/entities/album-attribute.entity";

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
		attributes: SearchAttributeDto[];
	}) {
		const attributeWhere: FindOptionsWhere<DBAttributeTemplate> = {};

		if (options.query) {
			attributeWhere.value_string = ILike(`%${options.query}%`);
		}

		let tracks: DBTrack[] = [];

		if (options.trackAmount) {
			const trackAttributeDtos = options.attributes.filter(
				(attribute) => attribute.entityType == AttributeEntity.TRACK,
			);

			if (trackAttributeDtos.length) {
				const trackIds = await this.findMatchingIds(
					trackAttributeDtos,
					this.trackManagerService.queryBuilder("track"),
					DBTrackAttribute,
					"track",
					options.trackAmount,
				);

				if (trackIds.length) {
					tracks = await this.trackManagerService.find({
						where: {
							uuid: In(trackIds),
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
					});
				}
			}
		}

		let artists: DBArtist[] = [];
		if (options.artistAmount) {
			const artistAttributeDtos = options.attributes.filter(
				(attribute) => attribute.entityType == AttributeEntity.ARTIST,
			);

			if (artistAttributeDtos.length) {
				const artistIds = await this.findMatchingIds(
					artistAttributeDtos,
					this.artistsRepository.createQueryBuilder("artist"),
					DBArtistAttribute,
					"artist",
					options.artistAmount,
				);

				if (artistIds.length) {
					artists = await this.artistsRepository.find({
						where: {
							uuid: In(artistIds),
						},
						relationLoadStrategy: "query",
						relations: {
							attributes: true,
						},
					});
				}
			}
		}

		let albums: DBAlbum[] = [];
		if (options.albumAmount) {
			const albumAttributeDtos = options.attributes.filter(
				(attribute) => attribute.entityType == AttributeEntity.ALBUM,
			);

			if (albumAttributeDtos.length) {
				const albumIds = await this.findMatchingIds(
					albumAttributeDtos,
					this.albumManagerService.queryBuilder("album"),
					DBAlbumAttribute,
					"album",
					options.albumAmount,
				);

				if (albumIds.length)
					albums = await this.albumManagerService.findMany({
						where: {
							uuid: In(albumIds),
						},
						withArtists: true,
						withAttributes: true,
						amount: options.albumAmount,
					});
			}
		}

		return {
			tracks,
			artists,
			albums,
		};
	}

	private async findMatchingIds(
		attributes: SearchAttributeDto[],
		queryBuilder: SelectQueryBuilder<any>,
		attributeType: typeof DBAttributeTemplate,
		rootAlias: string,
		amount: number,
	) {
		queryBuilder.select(`${rootAlias}.uuid`, "id");

		for (const [index, dto] of attributes.entries()) {
			const alias = `attr_${index}`;
			const paramPrefix = `p_${index}`;

			const subQuery = queryBuilder
				.subQuery()
				.select("1")
				.from(attributeType, alias)
				.where(`${alias}.entityRelationId = ${rootAlias}.uuid`)
				.andWhere(`${alias}.key = :${paramPrefix}_key`);

			queryBuilder.setParameter(`${paramPrefix}_key`, dto.key);

			let useNotExists = false;

			switch (dto.type) {
				case AttributeType.STRING: {
					const stringDto = dto as StringSearchAttributeDto;
					if (stringDto.query !== undefined) {
						if (stringDto.partial) {
							subQuery.andWhere(
								`${alias}.value_string LIKE :${paramPrefix}_string`,
							);
							queryBuilder.setParameter(
								`${paramPrefix}_string`,
								`%${stringDto.query}%`,
							);
						} else {
							subQuery.andWhere(
								`${alias}.value_string = :${paramPrefix}_string`,
							);
							queryBuilder.setParameter(
								`${paramPrefix}_string`,
								stringDto.query,
							);
						}
					}
					if (stringDto.query === undefined) {
						if (typeof stringDto.exists != "boolean") {
							throw new BadRequestException(
								"Empty attribute query is not supported",
							);
						}
						if (stringDto.exists) {
							subQuery.andWhere(`${alias}.value_string IS NOT NULL`);
						} else {
							useNotExists = true;
						}
					}

					break;
				}
				case AttributeType.BOOLEAN: {
					const boolDto = dto as BooleanSearchAttributeDto;
					if (boolDto.boolean !== undefined) {
						subQuery.andWhere(
							`${alias}.value_boolean = :${paramPrefix}_boolean`,
						);
						queryBuilder.setParameter(
							`${paramPrefix}_boolean`,
							boolDto.boolean,
						);
					}
					if (boolDto.boolean === undefined) {
						if (typeof boolDto.exists != "boolean") {
							throw new BadRequestException(
								"Empty attribute query is not supported",
							);
						}
						if (boolDto.exists) {
							subQuery.andWhere(`${alias}.value_boolean IS NOT NULL`);
						} else {
							useNotExists = true;
						}
					}
					break;
				}
				case AttributeType.INTEGER: {
					const intDto = dto as IntegerSearchAttributeDto;
					if (intDto.integer !== undefined) {
						subQuery.andWhere(`${alias}.value_int = :${paramPrefix}_int`);
						queryBuilder.setParameter(`${paramPrefix}_int`, intDto.integer);
					} else {
						if (intDto.min !== undefined) {
							subQuery.andWhere(`${alias}.value_int >= :${paramPrefix}_intMin`);
							queryBuilder.setParameter(`${paramPrefix}_intMin`, intDto.min);
						}
						if (intDto.max !== undefined) {
							subQuery.andWhere(`${alias}.value_int <= :${paramPrefix}_intMax`);
							queryBuilder.setParameter(`${paramPrefix}_intMax`, intDto.max);
						}
					}

					if (
						intDto.integer === undefined &&
						intDto.min === undefined &&
						intDto.max === undefined
					) {
						if (typeof intDto.exists != "boolean") {
							throw new BadRequestException(
								"Empty attribute query is not supported",
							);
						}
						if (intDto.exists) {
							subQuery.andWhere(`${alias}.value_int IS NOT NULL`);
						} else {
							useNotExists = true;
						}
					}
					break;
				}
				case AttributeType.DECIMAL: {
					const decimalDto = dto as DecimalSearchAttributeDto;
					if (decimalDto.decimal !== undefined) {
						subQuery.andWhere(
							`${alias}.value_decimal = :${paramPrefix}_decimal`,
						);
						queryBuilder.setParameter(
							`${paramPrefix}_decimal`,
							decimalDto.decimal,
						);
					} else {
						if (decimalDto.min !== undefined) {
							subQuery.andWhere(
								`${alias}.value_decimal >= :${paramPrefix}_decimalMin`,
							);
							queryBuilder.setParameter(
								`${paramPrefix}_decimalMin`,
								decimalDto.min,
							);
						}
						if (decimalDto.max !== undefined) {
							subQuery.andWhere(
								`${alias}.value_decimal <= :${paramPrefix}_decimalMax`,
							);
							queryBuilder.setParameter(
								`${paramPrefix}_decimalMax`,
								decimalDto.max,
							);
						}
					}

					if (
						decimalDto.decimal === undefined &&
						decimalDto.min === undefined &&
						decimalDto.max === undefined
					) {
						if (typeof decimalDto.exists != "boolean") {
							throw new BadRequestException(
								"Empty attribute query is not supported",
							);
						}
						if (decimalDto.exists) {
							subQuery.andWhere(`${alias}.value_decimal IS NOT NULL`);
						} else {
							useNotExists = true;
						}
					}
					break;
				}
				case AttributeType.BUFFER: {
					const bufferDto = dto as BufferSearchAttributeDto;
					if (bufferDto.exists) {
						subQuery.andWhere(`${alias}.value_buffer IS NOT NULL`);
					} else {
						useNotExists = true;
					}
					break;
				}
			}

			if (useNotExists) {
				queryBuilder.andWhere(`NOT EXISTS ${subQuery.getQuery()}`);
			} else {
				queryBuilder.andWhere(`EXISTS ${subQuery.getQuery()}`);
			}
		}

		queryBuilder.limit(amount);
		const results = (await queryBuilder.getRawMany()) as { id: string }[];
		return results.map(({ id }) => id);
	}
}
