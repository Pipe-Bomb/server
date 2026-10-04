import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { In, Repository } from "typeorm";
import { DBSavedAlbum } from "src/albums/entity/saved-album.entity";
import { DBSavedArtist } from "src/artists/entity/saved-artist.entity";
import { DBSavedTrack } from "src/tracks/entities/saved-track.entity";

@Injectable()
export class BookmarksService {
	constructor(
		@InjectRepository(DBSavedAlbum)
		private readonly savedAlbumsRepository: Repository<DBSavedAlbum>,
		@InjectRepository(DBSavedArtist)
		private readonly savedArtistsRepository: Repository<DBSavedArtist>,
		@InjectRepository(DBSavedTrack)
		private readonly savedTracksRepository: Repository<DBSavedTrack>,
	) {}

	async getBookmarkedAlbumUuids(
		userUuid: string | null,
		albumUuids: string[],
	): Promise<Set<string>> {
		if (!userUuid || !albumUuids.length) {
			return new Set();
		}
		const entries = await this.savedAlbumsRepository.find({
			where: { userUuid, albumUuid: In(albumUuids) },
			select: ["albumUuid"],
		});
		return new Set(entries.map(({ albumUuid }) => albumUuid));
	}

	async getBookmarkedArtistUuids(
		userUuid: string | null,
		artistUuids: string[],
	): Promise<Set<string>> {
		if (!userUuid || !artistUuids.length) {
			return new Set();
		}
		const entries = await this.savedArtistsRepository.find({
			where: { userUuid, artistUuid: In(artistUuids) },
			select: ["artistUuid"],
		});
		return new Set(entries.map(({ artistUuid }) => artistUuid));
	}

	async getBookmarkedTrackUuids(
		userUuid: string | null,
		trackUuids: string[],
	): Promise<Set<string>> {
		if (!userUuid || !trackUuids.length) {
			return new Set();
		}
		const entries = await this.savedTracksRepository.find({
			where: { userUuid, trackUuid: In(trackUuids) },
			select: ["trackUuid"],
		});
		return new Set(entries.map(({ trackUuid }) => trackUuid));
	}

	/**
	 * Walks a response object graph and annotates every album/artist/track
	 * response with whether the given user has bookmarked it.
	 *
	 * Entities are recognised by having both a `bookmarked` key and a string
	 * `uuid` (all three response DTOs set `bookmarked`, wrappers do not). The
	 * walk is cycle-safe and only descends into plain objects/arrays, so it is
	 * safe for streams, buffers, dates and class instances.
	 */
	async annotate<T>(userUuid: string | null, data: T): Promise<T> {
		if (!userUuid) {
			return data;
		}

		type Kind = "album" | "artist" | "track";
		const targets: { node: Record<string, any>; kind: Kind }[] = [];
		const seen = new WeakSet<object>();

		const visit = (node: any): void => {
			if (node === null || typeof node !== "object") {
				return;
			}
			if (seen.has(node)) {
				return;
			}
			seen.add(node);

			if (Array.isArray(node)) {
				for (const item of node) {
					visit(item);
				}
				return;
			}

			const prototype = Object.getPrototypeOf(node);
			if (prototype !== Object.prototype && prototype !== null) {
				return;
			}

			if (typeof node.uuid === "string" && "bookmarked" in node) {
				let kind: Kind | null = null;
				if (typeof node.trackId === "string") {
					kind = "track";
				} else if ("artists" in node) {
					kind = "album";
				} else if ("albums" in node) {
					kind = "artist";
				}
				if (kind) {
					targets.push({ node, kind });
				}
			}

			for (const key of Object.keys(node)) {
				visit(node[key]);
			}
		};

		visit(data);

		if (!targets.length) {
			return data;
		}

		const albumUuids: string[] = [];
		const artistUuids: string[] = [];
		const trackUuids: string[] = [];
		for (const { node, kind } of targets) {
			if (kind === "album") {
				albumUuids.push(node.uuid);
			} else if (kind === "artist") {
				artistUuids.push(node.uuid);
			} else {
				trackUuids.push(node.uuid);
			}
		}

		const [albums, artists, tracks] = await Promise.all([
			this.getBookmarkedAlbumUuids(userUuid, albumUuids),
			this.getBookmarkedArtistUuids(userUuid, artistUuids),
			this.getBookmarkedTrackUuids(userUuid, trackUuids),
		]);

		for (const { node, kind } of targets) {
			node.bookmarked =
				kind === "album"
					? albums.has(node.uuid)
					: kind === "artist"
						? artists.has(node.uuid)
						: tracks.has(node.uuid);
		}

		return data;
	}
}
