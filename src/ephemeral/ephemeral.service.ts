import { Injectable, Logger } from "@nestjs/common";
import {
	AttributeValue,
	BufferAttributeValue,
	EphemeralSource,
	EphemeralSourceSearchOptions,
	EphemeralTrack,
	IdentifiableAlbumMetadata,
	IdentifiableArtistMetadata,
} from "@sdk";
import { LoadedPlugin } from "src/plugins/interface/loaded-plugin.interface";
import { LoadedEphemeralSource } from "./interface/loaded-ephemeral-source.interface";
import { LoadedAttributeSource } from "src/attributes/interface/loaded-attribute-source.interface";
import { AttributeSourcesService } from "src/attribute-sources/attribute-sources.service";
import { LoadedAttribute } from "src/attributes/interface/loaded-attribute.interface";
import {
	BasePersistentAttributeResponse,
	PersistentAttributeResponse,
	PersistentBooleanAttributeResponse,
	PersistentBufferAttributeResponse,
	PersistentDecimalAttributeResponse,
	PersistentIntegerAttributeResponse,
	PersistentStringAttributeResponse,
} from "src/attributes/response/persistent-attribute.response";
import { randomUUID } from "crypto";
import { RelativeUrl } from "src/interception/relative-url";
import { ArtistIdentityTarget } from "src/artist-manager/enum/artist-identity-target.enum";
import { ArtistManagerService } from "src/artist-manager/artist-manager.service";
import { ArtistResponse } from "src/artist-manager/response/artist.response";
import { EphemeralTrackResponse } from "./response/ephemeral-track.response";
import { TrackArtistResponse } from "src/tracks/response/track-artist.response";
import { DBArtistIdentity } from "src/artist-manager/entity/artist-identity.entity";
import { AlbumResponse } from "src/albums/response/album.response";
import { AlbumArtistResponse } from "src/albums/response/album-artist.response";
import { DBAlbumIdentity } from "src/albums/entity/album-identity.entity";
import { AttributeType } from "src/attributes/enum/attribute-type.enum";
import { TrackId } from "src/tracks/interface/track-id.interface";
import { DBTrack } from "src/tracks/entities/track.entity";
import { TrackManagerService } from "src/track-manager/track-manager.service";
import { IdentifiersService } from "src/identifiers/identifiers.service";
import { TrackCreationSession } from "./interface/track-creation-session.interface";
import { TrackCreationSessionResponse } from "./response/track-creation-session.response";

@Injectable()
export class EphemeralService {
	private readonly logger = new Logger("Ephemeral Service");
	private readonly sources = new Map<
		string,
		Map<string, LoadedEphemeralSource>
	>();
	private readonly attributeSources = new Map<
		EphemeralSource,
		LoadedAttributeSource
	>();
	private readonly artistIdentifiers = new Map<string, LoadedEphemeralSource>();
	private readonly albumIdentifiers = new Map<string, LoadedEphemeralSource>();
	private readonly trackIdentifiers = new Map<string, LoadedEphemeralSource>();
	private readonly proxiedBufferAttributes = new Map<
		string,
		BufferAttributeValue
	>();
	private readonly creationSessions = new Map<string, TrackCreationSession>();

	constructor(
		private readonly attributeSourcesService: AttributeSourcesService,
		private readonly artistManagerService: ArtistManagerService,
		private readonly trackManagerService: TrackManagerService,
		private readonly identifiersService: IdentifiersService,
	) {}

	registerEphemeralSource(source: EphemeralSource, plugin: LoadedPlugin) {
		const pluginIdentifiers = this.sources.get(plugin.package.name);
		const loadedEphemeralSource: LoadedEphemeralSource = {
			source,
			plugin,
		};
		if (pluginIdentifiers) {
			if (pluginIdentifiers.has(source.id)) {
				throw new Error(
					`Plugin has already registered Ephemeral Source with ID "${source.id}"`,
				);
			}
			pluginIdentifiers.set(source.id, loadedEphemeralSource);
		} else {
			this.sources.set(
				plugin.package.name,
				new Map([[source.id, loadedEphemeralSource]]),
			);
		}

		source.enable({
			useAttributeSource: (attributeSource) => {
				if (this.attributeSources.has(source)) {
					throw new Error(
						"Ephemeral source has already selected an Attribute Source",
					);
				}

				const allSources = this.attributeSourcesService.getSources();
				const loadedSource = allSources.find(
					({ source }) => source == attributeSource,
				);

				if (!loadedSource) {
					throw new Error("Attribute source is not loaded");
				}

				this.attributeSources.set(source, loadedSource);
			},
			resolveArtistIdentifier: (identifierId) => {
				const key = `${plugin.package.name}:${identifierId}`;

				if (this.artistIdentifiers.has(key)) {
					throw new Error(
						"Identifier is already being resolved by another Ephemeral Source",
					);
				}

				this.artistIdentifiers.set(key, loadedEphemeralSource);
			},
			resolveAlbumIdentifier: (identifierId) => {
				const key = `${plugin.package.name}:${identifierId}`;

				if (this.albumIdentifiers.has(key)) {
					throw new Error(
						"Identifier is already being resolved by another Ephemeral Source",
					);
				}

				this.albumIdentifiers.set(key, loadedEphemeralSource);
			},
			useTrackIdentifier: (identifierId) => {
				const identifier = this.identifiersService
					.all()
					.find(
						(identifier) =>
							identifier.plugin.package.name == plugin.package.name &&
							identifier.identifier.id == identifierId,
					);
				if (!identifier) {
					throw new Error("Identifier is not loaded");
				}

				if (identifier.identifier.target != "track") {
					throw new Error(`Identifier is not of Target "track"`);
				}

				const key = `${plugin.package.name}:${identifierId}`;

				if (this.trackIdentifiers.has(key)) {
					throw new Error(
						"Identifier is already being resolved by another Ephemeral Source",
					);
				}

				this.trackIdentifiers.set(key, loadedEphemeralSource);
			},
		});

		this.logger.log(
			`Plugin "${plugin.package.name}" registered Ephemeral Source "${source.id}"`,
		);
	}

	allFlat() {
		return Array.from(this.sources.values()).flatMap((set) =>
			Array.from(set.values()),
		);
	}

	find(pluginId: string, sourceId: string) {
		return this.sources.get(pluginId)?.get(sourceId) ?? null;
	}

	async search(
		source: LoadedEphemeralSource,
		options: EphemeralSourceSearchOptions,
	) {
		const attributeSource = this.attributeSources.get(source.source) ?? null;

		const results = await source.source.search(options);

		return {
			...results,
			attributeSource,
		};
	}

	async resolveArtists(artistMetas: IdentifiableArtistMetadata[]) {
		const artistMap = new Map<string, IdentifiableArtistMetadata>();
		for (const artistMeta of artistMetas) {
			artistMap.set(
				`${artistMeta.pluginId}:${artistMeta.identityId}:${artistMeta.identity}`,
				artistMeta,
			);
		}

		const promises = Array.from(artistMap.values()).map((artistAttribute) =>
			this.artistManagerService
				.resolveArtist(
					artistAttribute.pluginId,
					artistAttribute.identityId,
					artistAttribute.identity,
					ArtistIdentityTarget.TRACK,
					false,
				)
				.then((artistUuid) => ({ artistUuid, artistAttribute })),
		);

		const results = await Promise.allSettled(promises);
		return artistMetas.map((artistMeta) => {
			const match = results.find(
				(result) =>
					result.status == "fulfilled" &&
					result.value.artistAttribute.pluginId == artistMeta.pluginId &&
					result.value.artistAttribute.identityId == artistMeta.identityId &&
					result.value.artistAttribute.identity == artistMeta.identity,
			);

			if (match?.status == "fulfilled") {
				return match.value.artistUuid;
			}
			return null;
		});
	}

	getEphemeralSourceByArtistIdentity(pluginId: string, identityId: string) {
		return this.artistIdentifiers.get(`${pluginId}:${identityId}`) ?? null;
	}

	getEphemeralSourceByAlbumIdentity(pluginId: string, identityId: string) {
		return this.albumIdentifiers.get(`${pluginId}:${identityId}`) ?? null;
	}

	getArtistIdentifiers(source: LoadedEphemeralSource) {
		const identifiers: string[] = [];
		for (const [key, matchingSource] of this.artistIdentifiers) {
			if (source == matchingSource) {
				const [_pluginId, identifierId] = key.split(":");
				identifiers.push(identifierId);
			}
		}

		return identifiers;
	}

	getAlbumIdentifiers(source: LoadedEphemeralSource) {
		const identifiers: string[] = [];
		for (const [key, matchingSource] of this.albumIdentifiers) {
			if (source == matchingSource) {
				const [_pluginId, identifierId] = key.split(":");
				identifiers.push(identifierId);
			}
		}

		return identifiers;
	}

	async getEphemeralArtistContent(
		source: LoadedEphemeralSource,
		identityId: string,
		identity: string,
	) {
		const content = await source.source.resolveArtistContent(
			identityId,
			identity,
		);

		if (!content) {
			return null;
		}

		const attributeSource = this.attributeSources.get(source.source) ?? null;

		let tracks: EphemeralTrackResponse[] | null = null;
		if (content.tracks) {
			tracks = await this.toTracksResponse(
				content.tracks,
				source,
				attributeSource,
			);
		}

		let albums: AlbumResponse[] | null = null;
		if (content.albums) {
			albums = await this.toAlbumsResponse(content.albums, attributeSource);
		}

		return {
			source,
			tracks,
			albums,
		};
	}

	async getEphemeralAlbumContent(
		source: LoadedEphemeralSource,
		identityId: string,
		identity: string,
	) {
		const content = await source.source.resolveAlbumContent(
			identityId,
			identity,
		);

		if (!content) {
			return null;
		}

		const attributeSource = this.attributeSources.get(source.source) ?? null;

		let tracks: EphemeralTrackResponse[] | null = null;

		if (content.tracks) {
			tracks = await this.toTracksResponse(
				content.tracks,
				source,
				attributeSource,
			);
		}

		return {
			source,
			tracks,
		};
	}

	getEphemeralArtistSources(identities: DBArtistIdentity[]) {
		const ephemeralSources = new Set<LoadedEphemeralSource>();
		for (const identity of identities) {
			const source = this.artistIdentifiers.get(
				`${identity.pluginId}:${identity.identifierId}`,
			);
			if (source) {
				ephemeralSources.add(source);
			}
		}
		return Array.from(ephemeralSources);
	}

	getEphemeralAlbumSources(identities: DBAlbumIdentity[]) {
		const ephemeralSources = new Set<LoadedEphemeralSource>();
		for (const identity of identities) {
			const source = this.albumIdentifiers.get(
				`${identity.pluginId}:${identity.identifierId}`,
			);
			if (source) {
				ephemeralSources.add(source);
			}
		}
		return Array.from(ephemeralSources);
	}

	async resolveEphemeralAlbum(
		pluginId: string,
		identityId: string,
		identity: string,
	): Promise<AlbumResponse | null> {
		const source = this.albumIdentifiers.get(`${pluginId}:${identityId}`);
		if (!source) {
			return null;
		}

		const album = await source.source.resolveAlbum(identityId, identity);
		if (!album) {
			return null;
		}

		const attributeSource = this.attributeSources.get(source.source) ?? null;
		const possibleAlbumAttributes = this.attributeSourcesService
			.getAlbumAttributes()
			.filter(
				(attribute) =>
					attributeSource &&
					this.attributeSourcesService.doSourcesMatch(
						attribute.source,
						attributeSource,
					),
			);

		const artists = await this.toArtistsResponse(
			album.artists ?? [],
			attributeSource,
		);

		return {
			uuid: null,
			artists: artists.map((artist, index) => ({
				artist,
				artistUuid: artist.uuid,
				joinPhrase: album.artists?.[index].joinPhrase ?? null,
			})),
			attributes: attributeSource
				? this.createEphemeralAttributes(
						album.attributes ?? [],
						attributeSource,
						possibleAlbumAttributes,
						"album",
					)
				: null,
			identities: [
				{
					pluginId,
					identityId,
					value: identity,
					ordinal: 0,
				},
			],
			tracks: null,
		};
	}

	async resolveEphemeralArtist(
		pluginId: string,
		identityId: string,
		identity: string,
	): Promise<ArtistResponse | null> {
		const source = this.artistIdentifiers.get(`${pluginId}:${identityId}`);
		if (!source) {
			return null;
		}

		const artist = await source.source.resolveArtist(identityId, identity);
		if (!artist) {
			return null;
		}

		const attributeSource = this.attributeSources.get(source.source) ?? null;
		const possibleArtistAttributes = this.attributeSourcesService
			.getArtistAttributes()
			.filter(
				(attribute) =>
					attributeSource &&
					this.attributeSourcesService.doSourcesMatch(
						attribute.source,
						attributeSource,
					),
			);

		return {
			uuid: null,
			albums: null,
			identities: [
				{
					pluginId,
					identityId,
					value: identity,
					ordinal: 0,
				},
			],
			tracks: null,
			attributes: attributeSource
				? this.createEphemeralAttributes(
						artist.attributes ?? [],
						attributeSource,
						possibleArtistAttributes,
						"artist",
					)
				: null,
		};
	}

	async toAlbumsResponse(
		albums: IdentifiableAlbumMetadata[],
		attributeSource: LoadedAttributeSource | null,
	): Promise<AlbumResponse[]> {
		if (!attributeSource) {
			return albums.map((album) => this.toAlbumResponse(album, null, null));
		}

		const albumArtists = albums.flatMap((album) => album.artists ?? []);
		const allArtistUuids = await this.resolveArtists(albumArtists);

		const possibleAlbumAttributes = this.attributeSourcesService
			.getAlbumAttributes()
			.filter((attribute) =>
				this.attributeSourcesService.doSourcesMatch(
					attribute.source,
					attributeSource,
				),
			);

		const possibleArtistAttributes = this.attributeSourcesService
			.getArtistAttributes()
			.filter((attribute) =>
				this.attributeSourcesService.doSourcesMatch(
					attribute.source,
					attributeSource,
				),
			);

		return albums.map((album) => {
			const attributes = this.createEphemeralAttributes(
				album.attributes ?? [],
				attributeSource,
				possibleAlbumAttributes,
				"album",
			);

			const artists = (album.artists ?? []).map((albumArtist) => {
				const index = albumArtists.indexOf(albumArtist);
				const artistUuid = allArtistUuids[index]!;

				const artist: AlbumArtistResponse = {
					artistUuid,
					joinPhrase: albumArtist.joinPhrase ?? null,
					artist: this.toArtistResponse(
						albumArtist,
						attributeSource,
						possibleArtistAttributes,
						artistUuid,
					),
				};

				return artist;
			});

			return {
				artists,
				attributes,
				uuid: null,
				tracks: null,
				identities: [
					{
						pluginId: album.pluginId,
						identityId: album.identityId,
						value: album.identity,
						ordinal: 0,
					},
				],
			};
		});
	}

	toAlbumResponse(
		album: IdentifiableAlbumMetadata,
		attributes: Record<string, PersistentAttributeResponse> | null,
		artists: AlbumArtistResponse[] | null,
	): AlbumResponse {
		return {
			uuid: null,
			artists,
			attributes,
			tracks: null,
			identities: [
				{
					pluginId: album.pluginId,
					identityId: album.identityId,
					value: album.identity,
					ordinal: 0,
				},
			],
		};
	}

	async toTracksResponse(
		tracks: EphemeralTrack[],
		ephemeralSource: LoadedEphemeralSource,
		attributeSource: LoadedAttributeSource | null,
	): Promise<EphemeralTrackResponse[]> {
		if (!attributeSource) {
			return tracks.map((track) =>
				this.toTrackResponse(track, ephemeralSource, null, null),
			);
		}

		const trackArtists = tracks.flatMap((track) => track.artists ?? []);
		const allArtistUuids = await this.resolveArtists(trackArtists);

		const possibleTrackAttributes = this.attributeSourcesService
			.getTrackAttributes()
			.filter((attribute) =>
				this.attributeSourcesService.doSourcesMatch(
					attribute.source,
					attributeSource,
				),
			);

		const possibleArtistAttributes = this.attributeSourcesService
			.getArtistAttributes()
			.filter((attribute) =>
				this.attributeSourcesService.doSourcesMatch(
					attribute.source,
					attributeSource,
				),
			);

		return tracks.map((track) => {
			const attributes = this.createEphemeralAttributes(
				track.attributes ?? [],
				attributeSource,
				possibleTrackAttributes,
				"track",
			);

			const artists = (track.artists ?? []).map((trackArtist) => {
				const index = trackArtists.indexOf(trackArtist);
				const artistUuid = allArtistUuids[index]!;

				const artist: TrackArtistResponse = {
					artistUuid,
					joinPhrase: trackArtist.joinPhrase ?? null,
					artist: this.toArtistResponse(
						trackArtist,
						attributeSource,
						possibleArtistAttributes,
						artistUuid,
					),
				};

				return artist;
			});

			return this.toTrackResponse(track, ephemeralSource, attributes, artists);
		});
	}

	async toArtistsResponse(
		artists: IdentifiableArtistMetadata[],
		attributeSource: LoadedAttributeSource | null,
	): Promise<ArtistResponse[]> {
		if (!attributeSource) {
			return artists.map((artist) =>
				this.toArtistResponse(artist, null, null, null),
			);
		}

		const artistUuids = await this.resolveArtists(artists);

		const possibleArtistAttributes = this.attributeSourcesService
			.getArtistAttributes()
			.filter((attribute) =>
				this.attributeSourcesService.doSourcesMatch(
					attribute.source,
					attributeSource,
				),
			);

		return artists.map((artist, index) =>
			this.toArtistResponse(
				artist,
				attributeSource,
				possibleArtistAttributes,
				artistUuids[index],
			),
		);
	}

	toArtistResponse(
		artist: IdentifiableArtistMetadata,
		attributeSource: LoadedAttributeSource | null,
		possibleAttributes: LoadedAttribute[] | null,
		artistUuid: string | null,
	): ArtistResponse {
		return {
			uuid: artistUuid,
			attributes: attributeSource
				? this.createEphemeralAttributes(
						artist.attributes ?? [],
						attributeSource,
						possibleAttributes ?? [],
						"artist",
					)
				: null,
			albums: null,
			tracks: null,
			identities: [
				{
					pluginId: artist.pluginId,
					identityId: artist.identityId,
					value: artist.identity,
					ordinal: 0,
				},
			],
		};
	}

	toTrackResponse(
		track: EphemeralTrack,
		source: LoadedEphemeralSource,
		attributes: Record<string, PersistentAttributeResponse> | null,
		artists: TrackArtistResponse[] | null,
	): EphemeralTrackResponse {
		return {
			trackId: track.id,
			title: track.title,
			pluginId: source.plugin.package.name,
			libraryId: source.source.getLibraryHandler().id,
			attributes,
			artists,
		};
	}

	createEphemeralAttributes(
		attributes: AttributeValue[],
		attributeSource: LoadedAttributeSource,
		possibleAttributes: LoadedAttribute[],
		type: "track" | "artist" | "album",
	): Record<string, PersistentAttributeResponse> {
		const attributeRecord: Record<
			string,
			BasePersistentAttributeResponse<any>
		> = {};

		for (const attribute of attributes) {
			const attributeTemplate = possibleAttributes.find(
				(possibleAttribute) => possibleAttribute.attribute.key == attribute.key,
			);

			if (!attributeTemplate) {
				throw new Error(
					`Plugin "${attributeSource.plugin.package.name}" has not registered an Attribute with key "${attribute.key}"`,
				);
			}

			const format = this.attributeSourcesService.getFormatter(type);

			function create<T>(
				constructor: new () => BasePersistentAttributeResponse<T>,
				value: T,
			) {
				const existingAttribute = attributeRecord[attribute.key];
				if (existingAttribute) {
					if (!(existingAttribute instanceof constructor)) {
						throw new Error(
							"Received multiple attributes of different types with the same key",
						);
					}
					if (attributeTemplate!.attribute.supportsMultiple) {
						throw new Error(
							"Received multiple values for an attribute that expects only one",
						);
					}
					existingAttribute.values.push(value);
					if (existingAttribute.formatted) {
						existingAttribute.formatted.push(
							format(
								attributeSource.plugin.package.name,
								attributeSource.source.id,
								attribute.key,
								existingAttribute.type,
								value as string | number | boolean,
							),
						);
					}
				} else {
					const newAttribute = new constructor();
					newAttribute.values = [value];
					if (newAttribute.type == AttributeType.BUFFER) {
						newAttribute.formatted = null;
					} else {
						newAttribute.formatted = [
							format(
								attributeSource.plugin.package.name,
								attributeSource.source.id,
								attribute.key,
								newAttribute.type,
								value as string | number | boolean,
							),
						];
					}
					attributeRecord[attribute.key] = newAttribute;
				}
			}

			switch (attributeTemplate.attribute.type) {
				case "boolean":
					if (typeof attribute.value != "boolean") {
						throw new Error(
							`Plugin "${attributeSource.plugin.package.name}"'s Attribute with key "${attribute.key}" is type boolean`,
						);
					}
					create(PersistentBooleanAttributeResponse, attribute.value);
					break;
				case "string":
					if (typeof attribute.value != "string") {
						throw new Error(
							`Plugin "${attributeSource.plugin.package.name}"'s Attribute with key "${attribute.key}" is type string`,
						);
					}
					create(PersistentStringAttributeResponse, attribute.value);
					break;
				case "decimal":
					if (typeof attribute.value != "number") {
						throw new Error(
							`Plugin "${attributeSource.plugin.package.name}"'s Attribute with key "${attribute.key}" is type decimal`,
						);
					}
					if (attribute.value == Infinity) {
						throw new Error(
							`Plugin "${attributeSource.plugin.package.name}"'s Attribute with key "${attribute.key}" doesn't support Infinity`,
						);
					}
					create(PersistentDecimalAttributeResponse, attribute.value);
					break;
				case "integer":
					if (typeof attribute.value != "number" || attribute.value % 1 !== 0) {
						throw new Error(
							`Plugin "${attributeSource.plugin.package.name}"'s Attribute with key "${attribute.key}" is type integer`,
						);
					}
					create(PersistentIntegerAttributeResponse, attribute.value);
					break;
				case "buffer":
					if (
						typeof attribute.value != "object" ||
						!(
							"buffer" in attribute.value &&
							"extension" in attribute.value &&
							(typeof attribute.value.buffer == "function" ||
								Buffer.isBuffer(attribute.value.buffer)) &&
							typeof attribute.value.extension == "string"
						)
					) {
						throw new Error(
							`Plugin "${attributeSource.plugin.package.name}"'s Attribute with key "${attribute.key}" is type buffer`,
						);
					}
					let uuid: string;
					do {
						uuid = randomUUID();
					} while (this.proxiedBufferAttributes.has(uuid));
					this.proxiedBufferAttributes.set(uuid, attribute.value);
					setTimeout(() => {
						this.proxiedBufferAttributes.delete(uuid);
					}, 30 * 60_000);

					create(PersistentBufferAttributeResponse, {
						extension: attribute.value.extension,
						sha256: null,
						uuid,
						url: new RelativeUrl(
							`/ephemeral/attribute-buffer/${uuid}.${attribute.value.extension}`,
						),
					});
					break;
			}
		}

		return attributeRecord;
	}

	getProxiedAttribute(uuid: string) {
		return this.proxiedBufferAttributes.get(uuid) ?? null;
	}

	async createTracks(
		tracks: TrackId[],
		options: {
			playlistUuids?: string[];
		} = {},
	) {
		let sessionId: string;
		do {
			sessionId = randomUUID();
		} while (this.creationSessions.has(sessionId));

		const session: TrackCreationSession = {
			uuid: sessionId,
			started: Date.now(),
			percent: null,
			playlistUuids: options.playlistUuids ?? [],
			promise: new Promise<(DBTrack | null)[]>(async (resolve, reject) => {
				try {
					const output: (DBTrack | null)[] = [];

					const order = tracks.map(
						(track) => `${track.pluginId}:${track.libraryId}:${track.trackId}`,
					);

					const sourceMap = new Map<
						string,
						{
							source: LoadedEphemeralSource;
							ids: Set<string>;
							tracks: EphemeralTrack[];
						}
					>();

					for (const track of tracks) {
						const sourceKey = `${track.pluginId}:${track.libraryId}`;
						const existingEntry = sourceMap.get(sourceKey);
						if (existingEntry) {
							existingEntry.ids.add(track.trackId);
						} else {
							const source = this.sources
								.get(track.pluginId)
								?.get(track.libraryId);
							if (!source) {
								throw new Error("Ephemeral Source does not exist");
							}
							sourceMap.set(sourceKey, {
								source,
								ids: new Set([track.trackId]),
								tracks: [],
							});
						}
					}

					let mapCompletedEntries = 0;
					for (const { source, ids, tracks } of sourceMap.values()) {
						try {
							const newTracks = await source.source.resolveTracks(
								Array.from(ids),
							);
							for (const track of newTracks) {
								if (ids.has(track.id)) {
									tracks.push(track);
								}
							}
							session.percent = (0.2 / sourceMap.size) * ++mapCompletedEntries;
						} catch (e) {
							this.logger.error(
								`Ephemeral Source ${source.source.id} from Plugin "${source.plugin.package.name}" failed to resolve tracks:`,
								e,
							);
						}
					}

					let completedTracks = 0;
					for (const { source, tracks } of sourceMap.values()) {
						if (!tracks.length) {
							continue;
						}

						this.logger.log(`Time to insert ${tracks.length} tracks`);
						const newTracks = await this.trackManagerService.addTracks(
							source.plugin,
							source.source.getLibraryHandler(),
							tracks,
						);

						const attributeSource =
							this.attributeSources.get(source.source) ?? null;
						if (!attributeSource) {
							this.logger.error(
								`Won't Atribute new Tracks or Artists because Attribute Source is not loaded`,
							);
						}

						for (const ephemeralTrack of tracks) {
							const dbTrack = newTracks.find(
								(track) => track.trackId == ephemeralTrack.id,
							);
							if (!dbTrack) {
								this.logger.error(
									`Failed to add Identity to new Track from Ephemeral Source "${source.source.id}" from Plugin "${source.plugin.package.name}" because it wasn't returned by database`,
								);
								completedTracks++;
								continue;
							}

							if (ephemeralTrack.artists) {
								const artistUuids = new Map<string, string[]>();

								for (const artist of ephemeralTrack.artists) {
									const artistUuid =
										await this.artistManagerService.resolveArtist(
											artist.pluginId,
											artist.identityId,
											artist.identity,
											ArtistIdentityTarget.TRACK,
											true,
										);
									const array = artistUuids.get(artist.identityId);
									if (array) {
										if (!array.includes(artistUuid)) {
											array.push(artistUuid);
										}
									} else {
										artistUuids.set(artistUuid, [artistUuid]);
									}

									if (artist.attributes?.length && attributeSource) {
										const attributes =
											await this.attributeSourcesService.createArtistAttributes(
												artistUuid,
												artist.attributes,
												attributeSource,
											);
										await this.attributeSourcesService.upsertArtistAttributes(
											attributes,
										);
									}
								}
								for (const [identityId, uuids] of artistUuids) {
									await this.artistManagerService.setTrackLinks(
										dbTrack,
										uuids,
										source.plugin.package.name,
										identityId,
									);
								}
							}

							if (ephemeralTrack.identityId) {
								const identifierKey = `${source.plugin.package.name}:${ephemeralTrack.identityId}`;
								const matchingSource = this.trackIdentifiers.get(identifierKey);
								if (matchingSource != source) {
									this.logger.error(
										`Ephemeral Source "${source.source.id}" from Plugin "${source.plugin.package.name}" attempted to use a Track Identity that it hasn't registered`,
									);
									completedTracks++;
									continue;
								}

								await this.identifiersService.identifyTrackWithIdentity(
									dbTrack,
									{
										pluginId: source.plugin.package.name,
										identityId: ephemeralTrack.identityId,
										identity: ephemeralTrack.identity,
									},
								);

								if (ephemeralTrack.attributes?.length && attributeSource) {
									const attributes =
										await this.attributeSourcesService.createTrackAttributes(
											dbTrack.uuid,
											ephemeralTrack.attributes,
											attributeSource,
										);
									await this.attributeSourcesService.upsertTrackAttributes(
										attributes,
									);
								}
							}

							const index = order.indexOf(
								`${dbTrack.pluginId}:${dbTrack.libraryId}:${dbTrack.trackId}`,
							);
							if (index < 0) {
								this.logger.error(`New Track didn't match original ID`);
								completedTracks++;
								continue;
							}
							output[index] = dbTrack;
							session.percent = 0.2 + (0.8 / order.length) * ++completedTracks;
						}
					}

					resolve(output);
				} catch (e) {
					reject(e);
				}
			}),
		};

		this.creationSessions.set(sessionId, session);
		session.promise.finally(() => this.creationSessions.delete(sessionId));
		return session;
	}

	getCreationSessionsByPlaylistUuid(playlistUuid: string) {
		const sessions: TrackCreationSession[] = [];

		for (const session of this.creationSessions.values()) {
			if (session.playlistUuids.includes(playlistUuid)) {
				sessions.push(session);
			}
		}
		return sessions;
	}

	toCreationSessionResponse(
		session: TrackCreationSession,
	): TrackCreationSessionResponse {
		return {
			uuid: session.uuid,
			dateStarted: new Date(session.started),
			percent:
				session.percent === null ? null : Math.min(session.percent * 100, 100),
		};
	}
}
