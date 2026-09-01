import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { AlbumManagerService } from "src/album-manager/album-manager.service";
import { DBArtist } from "src/artist-manager/entity/artist.entity";
import { TrackManagerService } from "src/track-manager/track-manager.service";
import { In, Repository } from "typeorm";
import { SearchSourceService } from "./search-source.service";
import {
	BooleanSearchAttributeDto,
	BufferSearchAttributeDto,
	DecimalSearchAttributeDto,
	IntegerSearchAttributeDto,
	SearchAttributeDto,
	StringSearchAttributeDto,
} from "./dto/search-attribute.dto";
import { SearchFilter } from "@sdk";
import { AttributeType } from "src/attributes/enum/attribute-type.enum";

@Injectable()
export class SearchService {
	constructor(
		private readonly trackManagerService: TrackManagerService,
		@InjectRepository(DBArtist)
		private readonly artistsRepository: Repository<DBArtist>,
		private readonly albumManagerService: AlbumManagerService,
		private readonly searchSourceService: SearchSourceService,
	) {}

	async search(options: {
		query?: string;
		sort?: { attributeKey: string; direction: "asc" | "desc" };
		trackAmount: number;
		artistAmount: number;
		albumAmount: number;
		attributes: SearchAttributeDto[];
	}) {
		if (!this.searchSourceService.hasSource()) {
			return { tracks: [], artists: [], albums: [] };
		}

		const filters = this.mapAttributesToFilters(options.attributes);
		const raw = await this.searchSourceService.search({
			query: options.query,
			sort: options.sort,
			filters: filters.length ? filters : undefined,
			entities: {
				tracks: options.trackAmount
					? { limit: options.trackAmount }
					: undefined,
				artists: options.artistAmount
					? { limit: options.artistAmount }
					: undefined,
				albums: options.albumAmount
					? { limit: options.albumAmount }
					: undefined,
			},
		});

		const orderedTrackUuids = raw.tracks ?? [];
		const fetchedTracks = orderedTrackUuids.length
			? await this.trackManagerService.find({
					where: { uuid: In(orderedTrackUuids) },
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
				})
			: [];
		const trackByUuid = new Map(fetchedTracks.map((t) => [t.uuid, t]));
		const tracks = orderedTrackUuids
			.map((uuid) => trackByUuid.get(uuid))
			.filter((t): t is (typeof fetchedTracks)[number] => t !== undefined);

		const orderedArtistUuids = raw.artists ?? [];
		const fetchedArtists = orderedArtistUuids.length
			? await this.artistsRepository.find({
					where: { uuid: In(orderedArtistUuids) },
					relationLoadStrategy: "query",
					relations: { attributes: true },
				})
			: [];
		const artistByUuid = new Map(fetchedArtists.map((a) => [a.uuid, a]));
		const artists = orderedArtistUuids
			.map((uuid) => artistByUuid.get(uuid))
			.filter((a): a is (typeof fetchedArtists)[number] => a !== undefined);

		const orderedAlbumUuids = raw.albums ?? [];
		const fetchedAlbums = orderedAlbumUuids.length
			? await this.albumManagerService.findMany({
					where: { uuid: In(orderedAlbumUuids) },
					withArtists: true,
					withAttributes: true,
					amount: orderedAlbumUuids.length,
				})
			: [];
		const albumByUuid = new Map(fetchedAlbums.map((a) => [a.uuid, a]));
		const albums = orderedAlbumUuids
			.map((uuid) => albumByUuid.get(uuid))
			.filter((a): a is (typeof fetchedAlbums)[number] => a !== undefined);

		return { tracks, artists, albums };
	}

	private mapAttributesToFilters(
		attributes: SearchAttributeDto[],
	): SearchFilter[] {
		return attributes.flatMap((attr): SearchFilter[] => {
			const entityType = attr.entityType as "track" | "artist" | "album";
			const attributeKey = attr.key;

			switch (attr.type) {
				case AttributeType.STRING: {
					const s = attr as StringSearchAttributeDto;
					return [
						{
							entityType,
							attributeKey,
							attributeType: "string",
							value: s.query,
							partial: s.partial,
							exists: s.exists,
						},
					];
				}
				case AttributeType.BOOLEAN: {
					const b = attr as BooleanSearchAttributeDto;
					return [
						{
							entityType,
							attributeKey,
							attributeType: "boolean",
							value: b.boolean,
							exists: b.exists,
						},
					];
				}
				case AttributeType.INTEGER: {
					const i = attr as IntegerSearchAttributeDto;
					return [
						{
							entityType,
							attributeKey,
							attributeType: "integer",
							value: i.integer,
							min: i.min,
							max: i.max,
							exists: i.exists,
						},
					];
				}
				case AttributeType.DECIMAL: {
					const d = attr as DecimalSearchAttributeDto;
					return [
						{
							entityType,
							attributeKey,
							attributeType: "decimal",
							value: d.decimal,
							min: d.min,
							max: d.max,
							exists: d.exists,
						},
					];
				}
				case AttributeType.BUFFER: {
					const buf = attr as BufferSearchAttributeDto;
					return [
						{
							entityType,
							attributeKey,
							attributeType: "buffer",
							exists: buf.exists,
						},
					];
				}
				default:
					return [];
			}
		});
	}
}
