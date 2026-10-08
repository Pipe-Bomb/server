/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-argument */
import { BadRequestException } from "@nestjs/common";
import { PlaylistsService } from "./playlists.service";
import { PlaylistVisibility } from "./enum/playlist-visibility.enum";
import { PlaylistMemberRole } from "./enum/playlist-member-role.enum";

describe("PlaylistsService", () => {
	let service: PlaylistsService;
	let playlistsRepository: any;
	let playlistTracksRepository: any;
	let membersRepository: any;
	let attributeSourcesService: any;
	let userManagerService: any;
	let attributeUploadService: any;

	beforeEach(() => {
		playlistsRepository = {
			create: jest.fn((opts: any) => opts),
			insert: jest.fn().mockResolvedValue(undefined),
			update: jest.fn().mockResolvedValue(undefined),
			find: jest.fn().mockResolvedValue([]),
			findOne: jest.fn().mockResolvedValue(null),
			findOneOrFail: jest.fn(),
			remove: jest.fn().mockResolvedValue(undefined),
		};
		playlistTracksRepository = {
			upsert: jest.fn().mockResolvedValue(undefined),
			delete: jest.fn().mockResolvedValue(undefined),
			find: jest.fn().mockResolvedValue([]),
			findAndCount: jest.fn().mockResolvedValue([[], 0]),
		};
		membersRepository = {
			find: jest.fn().mockResolvedValue([]),
			findOne: jest.fn().mockResolvedValue(null),
			findOneOrFail: jest.fn(),
			upsert: jest.fn().mockResolvedValue(undefined),
			delete: jest.fn().mockResolvedValue(undefined),
		};
		attributeSourcesService = {
			registerPlaylistAttribute: jest.fn(),
			createPlaylistAttributes: jest.fn().mockResolvedValue([]),
			upsertPlaylistAttributes: jest.fn().mockResolvedValue(undefined),
			getPlaylistAttributes: jest.fn().mockReturnValue([]),
			getAttributeSource: jest.fn().mockReturnValue(null),
		};
		userManagerService = {
			findOne: jest.fn().mockResolvedValue(null),
		};
		attributeUploadService = {
			createSession: jest.fn().mockReturnValue({ uuid: "session-1" }),
		};

		service = new PlaylistsService(
			playlistsRepository,
			playlistTracksRepository,
			membersRepository,
			attributeSourcesService,
			userManagerService,
			attributeUploadService,
		);
	});

	it("registers the built-in title and thumb playlist attributes", () => {
		expect(
			attributeSourcesService.registerPlaylistAttribute,
		).toHaveBeenCalledTimes(2);
		expect(
			attributeSourcesService.registerPlaylistAttribute,
		).toHaveBeenCalledWith(null, {
			key: "title",
			type: "string",
			supportsMultiple: false,
		});
		expect(
			attributeSourcesService.registerPlaylistAttribute,
		).toHaveBeenLastCalledWith(null, {
			key: "thumb",
			type: "buffer",
			supportsMultiple: false,
		});
	});

	describe("create", () => {
		it("creates a playlist and persists its attributes", async () => {
			const created = { uuid: "pl-1" };
			playlistsRepository.create.mockReturnValue(created);
			const newAttrs = [{ key: "title" }];
			attributeSourcesService.createPlaylistAttributes.mockResolvedValue(
				newAttrs,
			);

			const playlist = await service.create(null, null, []);

			expect(playlistsRepository.insert).toHaveBeenCalledWith(created);
			expect(
				attributeSourcesService.createPlaylistAttributes,
			).toHaveBeenCalledWith("pl-1", [], null);
			expect(playlist.attributes).toEqual(newAttrs);
			expect(
				attributeSourcesService.upsertPlaylistAttributes,
			).toHaveBeenCalledWith("pl-1", null, newAttrs);
		});

		it("throws Invalid Attributes when attribute creation fails", async () => {
			playlistsRepository.create.mockReturnValue({ uuid: "pl-1" });
			attributeSourcesService.createPlaylistAttributes.mockRejectedValue(
				new Error("bad"),
			);

			await expect(service.create(null, null, [])).rejects.toThrow(
				BadRequestException,
			);
		});

		it("creates with an owner and attribute source", async () => {
			const owner = { uuid: "user-1" } as any;
			const source = { id: "src-1" } as any;
			playlistsRepository.create.mockReturnValue({ uuid: "pl-1", owner });

			await service.create(owner, source, []);

			expect(playlistsRepository.create).toHaveBeenCalledWith({ owner });
			expect(
				attributeSourcesService.upsertPlaylistAttributes,
			).toHaveBeenCalledWith("pl-1", source, []);
		});
	});

	describe("updateAttributes", () => {
		it("persists non-buffer attributes and drops the replaced keys", async () => {
			const playlist = {
				uuid: "pl-1",
				attributes: [{ key: "title" }],
			} as any;
			attributeSourcesService.getPlaylistAttributes.mockReturnValue([
				{
					attribute: { key: "title", type: "string", supportsMultiple: false },
				},
			]);
			attributeSourcesService.createPlaylistAttributes.mockResolvedValue([
				{ key: "title" },
			]);

			const result = await service.updateAttributes(
				playlist,
				[{ key: "title", value: "new" }] as any,
				null,
			);

			expect(result).toEqual([]);
			expect(
				attributeSourcesService.createPlaylistAttributes,
			).toHaveBeenCalledWith("pl-1", [{ key: "title", value: "new" }], null);
			expect(playlist.attributes).toEqual([]);
		});

		it("throws when handling buffer attributes without a user", async () => {
			const playlist = { uuid: "pl-1", attributes: [] } as any;
			attributeSourcesService.getPlaylistAttributes.mockReturnValue([
				{
					attribute: { key: "thumb", type: "buffer", supportsMultiple: false },
				},
			]);

			await expect(
				service.updateAttributes(
					playlist,
					[{ key: "thumb", value: { extension: "png" } }] as any,
					null,
				),
			).rejects.toThrow("Buffer attributes cannot be handled without a User");
		});

		it("creates an upload session per buffer attribute when a user is present", async () => {
			const playlist = { uuid: "pl-1", attributes: [] } as any;
			const user = { uuid: "user-1" } as any;
			attributeSourcesService.getPlaylistAttributes.mockReturnValue([
				{
					attribute: { key: "thumb", type: "buffer", supportsMultiple: false },
				},
			]);

			const result = await service.updateAttributes(
				playlist,
				[{ key: "thumb", value: { extension: "png" } }] as any,
				null,
				user,
			);

			expect(attributeUploadService.createSession).toHaveBeenCalledWith(
				user,
				"thumb",
				"png",
				expect.any(Function),
				expect.any(Function),
			);
			expect(result).toEqual([{ uuid: "session-1" }]);
		});

		it("throws Invalid Attributes when attribute creation fails", async () => {
			const playlist = { uuid: "pl-1", attributes: [] } as any;
			attributeSourcesService.getPlaylistAttributes.mockReturnValue([
				{
					attribute: { key: "title", type: "string", supportsMultiple: false },
				},
			]);
			attributeSourcesService.createPlaylistAttributes.mockRejectedValue(
				new Error("bad"),
			);

			await expect(
				service.updateAttributes(
					playlist,
					[{ key: "title", value: "x" }] as any,
					null,
				),
			).rejects.toThrow(BadRequestException);
		});

		it("treats an already-buffered value as a regular attribute", async () => {
			const playlist = { uuid: "pl-1", attributes: [] } as any;
			attributeSourcesService.getPlaylistAttributes.mockReturnValue([
				{
					attribute: { key: "thumb", type: "buffer", supportsMultiple: false },
				},
			]);

			const result = await service.updateAttributes(
				playlist,
				[
					{
						key: "thumb",
						value: { extension: "png", buffer: Buffer.from("img") },
					},
				] as any,
				null,
			);

			expect(result).toEqual([]);
			expect(attributeUploadService.createSession).not.toHaveBeenCalled();
			expect(
				attributeSourcesService.createPlaylistAttributes,
			).toHaveBeenCalledWith(
				"pl-1",
				[
					{
						key: "thumb",
						value: { extension: "png", buffer: Buffer.from("img") },
					},
				],
				null,
			);
		});

		it("leaves a missing attributes array untouched", async () => {
			const playlist = { uuid: "pl-1" } as any;
			attributeSourcesService.getPlaylistAttributes.mockReturnValue([
				{
					attribute: { key: "title", type: "string", supportsMultiple: false },
				},
			]);

			await service.updateAttributes(
				playlist,
				[{ key: "title", value: "x" }] as any,
				null,
			);

			expect(playlist.attributes).toBeUndefined();
		});

		it("re-saves buffer attributes once the upload resolves", async () => {
			const playlist = { uuid: "pl-1", attributes: [] } as any;
			const user = { uuid: "user-1" } as any;
			const value = { extension: "png" };
			attributeSourcesService.getPlaylistAttributes.mockReturnValue([
				{
					attribute: { key: "thumb", type: "buffer", supportsMultiple: false },
				},
			]);
			let resolveUpload: (buffer: Buffer) => void = () => {};
			attributeUploadService.createSession.mockImplementation(
				(
					_user: any,
					_key: string,
					_ext: string,
					onResolve: (buffer: Buffer) => void,
				) => {
					resolveUpload = onResolve;
					return { uuid: "session-1" };
				},
			);

			await service.updateAttributes(
				playlist,
				[{ key: "thumb", value }] as any,
				null,
				user,
			);
			expect(
				attributeSourcesService.createPlaylistAttributes,
			).toHaveBeenCalledTimes(1);

			resolveUpload(Buffer.from("img"));
			await new Promise((r) => setImmediate(r));
			await new Promise((r) => setImmediate(r));

			expect(value.buffer).toEqual(Buffer.from("img"));
			expect(
				attributeSourcesService.createPlaylistAttributes,
			).toHaveBeenCalledTimes(2);
			expect(
				attributeSourcesService.upsertPlaylistAttributes,
			).toHaveBeenCalledTimes(2);
		});

		it("skips the delayed re-save when the upload rejects", async () => {
			const playlist = { uuid: "pl-1", attributes: [] } as any;
			const user = { uuid: "user-1" } as any;
			const value = { extension: "png" };
			attributeSourcesService.getPlaylistAttributes.mockReturnValue([
				{
					attribute: { key: "thumb", type: "buffer", supportsMultiple: false },
				},
			]);
			let rejectUpload: (error: Error) => void = () => {};
			attributeUploadService.createSession.mockImplementation(
				(
					_user: any,
					_key: string,
					_ext: string,
					_onResolve: (buffer: Buffer) => void,
					onReject: (error: Error) => void,
				) => {
					rejectUpload = onReject;
					return { uuid: "session-1" };
				},
			);

			await service.updateAttributes(
				playlist,
				[{ key: "thumb", value }] as any,
				null,
				user,
			);

			rejectUpload(new Error("upload failed"));
			await new Promise((r) => setImmediate(r));
			await new Promise((r) => setImmediate(r));

			expect(
				attributeSourcesService.createPlaylistAttributes,
			).toHaveBeenCalledTimes(1);
			expect(
				attributeSourcesService.upsertPlaylistAttributes,
			).toHaveBeenCalledTimes(1);
		});
	});

	describe("setVisibility", () => {
		it("updates the playlist visibility", async () => {
			await service.setVisibility("pl-1", PlaylistVisibility.PRIVATE);
			expect(playlistsRepository.update).toHaveBeenCalledWith(
				{ uuid: "pl-1" },
				{ visibility: PlaylistVisibility.PRIVATE },
			);
		});
	});

	describe("findForUser", () => {
		it("returns owned and member playlists without duplicates", async () => {
			const user = { uuid: "user-1" } as any;
			playlistsRepository.find.mockResolvedValue([{ uuid: "owned-1" }]);
			membersRepository.find.mockResolvedValue([
				{ playlist: { uuid: "owned-1" } },
				{ playlist: { uuid: "member-1" } },
			]);

			const result = await service.findForUser(user);

			expect(result.map((p: any) => p.uuid)).toEqual(["owned-1", "member-1"]);
		});

		it("requests attributes only when withAttributes is set", async () => {
			const user = { uuid: "user-1" } as any;

			await service.findForUser(user, { withAttributes: true });

			expect(playlistsRepository.find).toHaveBeenCalledWith({
				where: { ownerUuid: "user-1" },
				relations: { attributes: true },
			});

			playlistsRepository.find.mockClear();
			await service.findForUser(user);

			expect(playlistsRepository.find).toHaveBeenCalledWith({
				where: { ownerUuid: "user-1" },
				relations: { attributes: false },
			});
		});

		it("drops memberships whose playlist relation is missing", async () => {
			const user = { uuid: "user-1" } as any;
			playlistsRepository.find.mockResolvedValue([{ uuid: "owned-1" }]);
			membersRepository.find.mockResolvedValue([
				{ playlist: null },
				{ playlist: { uuid: "owned-1" } },
				{ playlist: { uuid: "member-1" } },
			]);

			const result = await service.findForUser(user);

			expect(result.map((p: any) => p.uuid)).toEqual(["owned-1", "member-1"]);
		});
	});

	describe("getMemberRole", () => {
		it("returns the member role, or null when not a member", async () => {
			membersRepository.findOne.mockResolvedValue({
				role: PlaylistMemberRole.COLLABORATOR,
			});
			await expect(service.getMemberRole("pl-1", "user-1")).resolves.toBe(
				PlaylistMemberRole.COLLABORATOR,
			);

			membersRepository.findOne.mockResolvedValue(null);
			await expect(service.getMemberRole("pl-1", "user-1")).resolves.toBeNull();
		});
	});

	describe("findMembers", () => {
		it("finds members ordered by date added", async () => {
			membersRepository.find.mockResolvedValue([{ role: "viewer" }]);

			await expect(service.findMembers("pl-1")).resolves.toEqual([
				{ role: "viewer" },
			]);
			expect(membersRepository.find).toHaveBeenCalledWith({
				where: { playlistUuid: "pl-1" },
				relations: { user: true },
				order: { dateAdded: "asc" },
			});
		});
	});

	describe("upsertMember", () => {
		it("upserts the member and returns it", async () => {
			const member = {
				playlistUuid: "pl-1",
				userUuid: "user-1",
				role: PlaylistMemberRole.COLLABORATOR,
			};
			membersRepository.findOneOrFail.mockResolvedValue(member);

			await expect(
				service.upsertMember("pl-1", "user-1", PlaylistMemberRole.COLLABORATOR),
			).resolves.toBe(member);
			expect(membersRepository.upsert).toHaveBeenCalledWith(
				{
					playlistUuid: "pl-1",
					userUuid: "user-1",
					role: PlaylistMemberRole.COLLABORATOR,
				},
				{
					conflictPaths: ["playlistUuid", "userUuid"],
					skipUpdateIfNoValuesChanged: true,
				},
			);
		});
	});

	describe("removeMember", () => {
		it("deletes the member row", async () => {
			await service.removeMember("pl-1", "user-1");
			expect(membersRepository.delete).toHaveBeenCalledWith({
				playlistUuid: "pl-1",
				userUuid: "user-1",
			});
		});
	});

	describe("findByUuid", () => {
		it("returns null when the playlist does not exist", async () => {
			playlistsRepository.findOne.mockResolvedValue(null);
			await expect(service.findByUuid("missing")).resolves.toBeNull();
		});

		it("returns the playlist with a track count when tracks are requested", async () => {
			playlistsRepository.findOne.mockResolvedValue({ uuid: "pl-1" });
			playlistTracksRepository.findAndCount.mockResolvedValue([
				[{ uuid: "t1" }],
				5,
			]);

			const result = await service.findByUuid("pl-1", { withTracks: 10 });

			expect(result.trackCount).toBe(5);
			expect(result.playlist.uuid).toBe("pl-1");
			expect(result.playlist.tracks).toEqual([{ uuid: "t1" }]);
		});

		it("returns a null track count when tracks are not requested", async () => {
			playlistsRepository.findOne.mockResolvedValue({ uuid: "pl-1" });

			const result = await service.findByUuid("pl-1");

			expect(result).toEqual({ playlist: { uuid: "pl-1" }, trackCount: null });
			expect(playlistTracksRepository.findAndCount).not.toHaveBeenCalled();
		});

		it("requests owner and smart filter relations when enabled", async () => {
			playlistsRepository.findOne.mockResolvedValue({ uuid: "pl-1" });

			await service.findByUuid("pl-1", {
				withAttributes: true,
				withOwner: true,
				withSmartFilters: true,
			});

			expect(playlistsRepository.findOne).toHaveBeenCalledWith({
				where: { uuid: "pl-1" },
				relationLoadStrategy: "query",
				relations: {
					attributes: true,
					owner: true,
					filterGroups: { filters: true },
				},
			});
		});

		it("requests the enabled track relations", async () => {
			playlistsRepository.findOne.mockResolvedValue({ uuid: "pl-1" });

			await service.findByUuid("pl-1", {
				withTracks: 3,
				withTrackArtists: true,
				withTrackAttributes: true,
				withTrackAlbums: true,
				withTrackUsers: true,
			});

			expect(playlistTracksRepository.findAndCount).toHaveBeenCalledWith(
				expect.objectContaining({
					take: 3,
					relations: {
						track: {
							artists: { artist: { attributes: true } },
							attributes: true,
							albums: { album: { attributes: true } },
						},
						addedBy: true,
					},
				}),
			);
		});
	});

	describe("findAllTracks", () => {
		it("finds every track for a playlist", async () => {
			playlistTracksRepository.find.mockResolvedValue([{ uuid: "t1" }]);

			await expect(
				service.findAllTracks({ uuid: "pl-1" } as any),
			).resolves.toEqual([{ uuid: "t1" }]);
			expect(playlistTracksRepository.find).toHaveBeenCalledWith({
				where: { playlistUuid: "pl-1" },
				relations: { track: true },
				order: { dateAdded: "asc", ordinal: "asc" },
			});
		});
	});

	describe("findTracks", () => {
		it("paginates tracks with offset and amount", async () => {
			await service.findTracks({ uuid: "pl-1" } as any, {
				offset: 10,
				amount: 20,
			});

			expect(playlistTracksRepository.find).toHaveBeenCalledWith(
				expect.objectContaining({
					take: 20,
					skip: 10,
					where: { playlistUuid: "pl-1" },
				}),
			);
		});
	});

	describe("addTracks", () => {
		it("upserts tracks with ordinals and bumps the modified date", async () => {
			const playlist = { uuid: "pl-1" } as any;
			const tracks = [{ uuid: "t1" }, { uuid: "t2" }] as any;
			const user = { uuid: "user-1" } as any;

			await service.addTracks(playlist, tracks, user);

			expect(playlistTracksRepository.upsert).toHaveBeenCalledWith(
				[
					{
						trackUuid: "t1",
						playlistUuid: "pl-1",
						addedByUuid: "user-1",
						ordinal: 0,
					},
					{
						trackUuid: "t2",
						playlistUuid: "pl-1",
						addedByUuid: "user-1",
						ordinal: 1,
					},
				],
				{
					conflictPaths: ["trackUuid", "playlistUuid"],
					skipUpdateIfNoValuesChanged: true,
				},
			);
			expect(playlistsRepository.update).toHaveBeenCalled();
		});

		it("sets dateModified on the playlist object and persists it", async () => {
			const playlist = { uuid: "pl-1", dateModified: null } as any;

			await service.addTracks(playlist, ["t1"], null);

			expect(playlist.dateModified).toEqual(expect.any(Number));
			expect(playlistsRepository.update).toHaveBeenCalledWith(
				{ uuid: "pl-1" },
				{ dateModified: playlist.dateModified },
			);
		});

		it("accepts raw string playlist and track ids", async () => {
			await service.addTracks("pl-1", ["t1", "t2"], null);

			expect(playlistTracksRepository.upsert).toHaveBeenCalledWith(
				[
					{
						trackUuid: "t1",
						playlistUuid: "pl-1",
						addedByUuid: null,
						ordinal: 0,
					},
					{
						trackUuid: "t2",
						playlistUuid: "pl-1",
						addedByUuid: null,
						ordinal: 1,
					},
				],
				expect.any(Object),
			);
		});
	});

	describe("removeTracks", () => {
		it("deletes the requested tracks and bumps the modified date", async () => {
			await service.removeTracks("pl-1", ["t1", "t2"]);

			expect(playlistTracksRepository.delete).toHaveBeenCalledWith(
				expect.objectContaining({
					playlistUuid: "pl-1",
					trackUuid: expect.anything(),
				}),
			);
			const deleteArg = playlistTracksRepository.delete.mock.calls[0][0];
			expect(deleteArg.trackUuid._type).toBe("in");
			expect(deleteArg.trackUuid._value).toEqual(["t1", "t2"]);
			expect(playlistsRepository.update).toHaveBeenCalled();
		});

		it("accepts object playlists and tracks", async () => {
			const playlist = { uuid: "pl-1" } as any;

			await service.removeTracks(playlist, [{ uuid: "t1" }] as any);

			const deleteArg = playlistTracksRepository.delete.mock.calls[0][0];
			expect(deleteArg.playlistUuid).toBe("pl-1");
			expect(deleteArg.trackUuid._type).toBe("in");
			expect(deleteArg.trackUuid._value).toEqual(["t1"]);
			expect(playlistsRepository.update).toHaveBeenCalledWith(
				{ uuid: "pl-1" },
				{ dateModified: expect.any(Number) },
			);
		});
	});

	describe("delete", () => {
		it("removes the playlist", async () => {
			await service.delete({ uuid: "pl-1" } as any);
			expect(playlistsRepository.remove).toHaveBeenCalledWith({ uuid: "pl-1" });
		});
	});

	describe("createPlaylistClient", () => {
		const plugin = { package: { name: "plug-a" } } as any;

		it("returns the owned playlist uuids for a user", async () => {
			playlistsRepository.find.mockResolvedValue([
				{ uuid: "pl-1" },
				{ uuid: "pl-2" },
			]);
			const client = service.createPlaylistClient(plugin);

			await expect(client.getUserPlaylistUuids("user-1")).resolves.toEqual([
				"pl-1",
				"pl-2",
			]);
			expect(playlistsRepository.find).toHaveBeenCalledWith({
				where: { ownerUuid: "user-1" },
				select: ["uuid"],
			});
		});

		it("returns the member playlist uuids", async () => {
			membersRepository.find.mockResolvedValue([{ playlistUuid: "pl-9" }]);
			const client = service.createPlaylistClient(plugin);

			await expect(client.getMemberPlaylistUuids("user-1")).resolves.toEqual([
				"pl-9",
			]);
		});

		it("returns null from getPlaylist when the playlist does not exist", async () => {
			playlistsRepository.findOne.mockResolvedValue(null);
			const client = service.createPlaylistClient(plugin);

			await expect(client.getPlaylist("missing")).resolves.toBeNull();
		});

		it("returns the saved response when the playlist exists", async () => {
			playlistsRepository.findOne.mockResolvedValue({
				toSavedResponse: () => ({ uuid: "pl-1" }),
			});
			const client = service.createPlaylistClient(plugin);

			await expect(client.getPlaylist("pl-1")).resolves.toEqual({
				uuid: "pl-1",
			});
		});

		describe("addToPlaylist", () => {
			const ownedPlaylist = { uuid: "pl-1", ownerUuid: "owner-1" };

			it("throws when the playlist does not exist", async () => {
				playlistsRepository.findOne.mockResolvedValue(null);
				const client = service.createPlaylistClient(plugin);

				await expect(
					client.addToPlaylist("missing", ["t1"]),
				).rejects.toThrow("Playlist doesn't exist");
			});

			it("throws when the asUser user does not exist", async () => {
				playlistsRepository.findOne.mockResolvedValue(ownedPlaylist);
				userManagerService.findOne.mockResolvedValue(null);
				const client = service.createPlaylistClient(plugin);

				await expect(
					client.addToPlaylist("pl-1", ["t1"], { asUser: "user-9" }),
				).rejects.toThrow("User doesn't exist");
			});

			it("allows the owner to add tracks", async () => {
				playlistsRepository.findOne.mockResolvedValue(ownedPlaylist);
				userManagerService.findOne.mockResolvedValue({ uuid: "owner-1" });
				const client = service.createPlaylistClient(plugin);

				await client.addToPlaylist("pl-1", ["t1"], { asUser: "owner-1" });

				expect(playlistTracksRepository.upsert).toHaveBeenCalledWith(
					[
						{
							trackUuid: "t1",
							playlistUuid: "pl-1",
							addedByUuid: "owner-1",
							ordinal: 0,
						},
					],
					expect.any(Object),
				);
			});

			it("allows collaborators but rejects other roles", async () => {
				playlistsRepository.findOne.mockResolvedValue(ownedPlaylist);
				userManagerService.findOne.mockResolvedValue({ uuid: "user-2" });
				const client = service.createPlaylistClient(plugin);

				membersRepository.findOne.mockResolvedValue({
					role: PlaylistMemberRole.VIEWER,
				});
				await expect(
					client.addToPlaylist("pl-1", ["t1"], { asUser: "user-2" }),
				).rejects.toThrow("User cannot modify playlist");

				membersRepository.findOne.mockResolvedValue({
					role: PlaylistMemberRole.COLLABORATOR,
				});
				await client.addToPlaylist("pl-1", ["t1"], { asUser: "user-2" });
				expect(playlistTracksRepository.upsert).toHaveBeenCalledTimes(1);
			});
		});

		describe("removeFromPlaylist", () => {
			it("throws when the playlist does not exist", async () => {
				playlistsRepository.findOne.mockResolvedValue(null);
				const client = service.createPlaylistClient(plugin);

				await expect(
					client.removeFromPlaylist("missing", ["t1"]),
				).rejects.toThrow("Playlist doesn't exist");
			});
		});

		describe("createPlaylist", () => {
			it("throws when the owner user does not exist", async () => {
				userManagerService.findOne.mockResolvedValue(null);
				const client = service.createPlaylistClient(plugin);

				await expect(
					client.createPlaylist({ ownerUuid: "user-9" }),
				).rejects.toThrow("User doesn't exist");
			});

			it("throws when the attribute source is not registered", async () => {
				const client = service.createPlaylistClient(plugin);

				await expect(
					client.createPlaylist({
						attributes: { sourceId: "src-x", attributes: [] },
					}),
				).rejects.toThrow("Attribute source not registered");
			});

			it("creates the playlist with owner and source and returns its uuid", async () => {
				const owner = { uuid: "user-1" } as any;
				const source = { id: "src-1" } as any;
				playlistsRepository.create.mockReturnValue({ uuid: "pl-1", owner });
				userManagerService.findOne.mockResolvedValue(owner);
				attributeSourcesService.getAttributeSource.mockReturnValue(source);
				const client = service.createPlaylistClient(plugin);

				const uuid = await client.createPlaylist({
					ownerUuid: "user-1",
					attributes: {
						sourceId: "src-1",
						attributes: [{ key: "title", value: "hello" }],
					},
				});

				expect(uuid).toBe("pl-1");
				expect(
					attributeSourcesService.createPlaylistAttributes,
				).toHaveBeenCalledWith("pl-1", [{ key: "title", value: "hello" }], null);
				expect(
					attributeSourcesService.upsertPlaylistAttributes,
				).toHaveBeenCalledWith("pl-1", source, []);
			});
		});

		describe("deletePlaylist", () => {
			it("rejects non-owners and deletes for the owner", async () => {
				playlistsRepository.findOne.mockResolvedValue({
					uuid: "pl-1",
					ownerUuid: "owner-1",
				});
				const client = service.createPlaylistClient(plugin);

				userManagerService.findOne.mockResolvedValue({ uuid: "user-2" });
				await expect(
					client.deletePlaylist("pl-1", { asUser: "user-2" }),
				).rejects.toThrow("User cannot delete playlist");
				expect(playlistsRepository.remove).not.toHaveBeenCalled();

				userManagerService.findOne.mockResolvedValue({ uuid: "owner-1" });
				await client.deletePlaylist("pl-1", { asUser: "owner-1" });
				expect(playlistsRepository.remove).toHaveBeenCalledTimes(1);
			});
		});

		describe("updatePlaylistAttributes", () => {
			it("throws when the attribute source is not registered", async () => {
				playlistsRepository.findOne.mockResolvedValue({
					uuid: "pl-1",
					ownerUuid: "owner-1",
				});
				const client = service.createPlaylistClient(plugin);

				await expect(
					client.updatePlaylistAttributes("pl-1", "src-x", []),
				).rejects.toThrow("Attribute source not registered");
			});

			it("throws when the user is not the owner", async () => {
				playlistsRepository.findOne.mockResolvedValue({
					uuid: "pl-1",
					ownerUuid: "owner-1",
				});
				userManagerService.findOne.mockResolvedValue({ uuid: "user-2" });
				const client = service.createPlaylistClient(plugin);

				await expect(
					client.updatePlaylistAttributes("pl-1", null, [], {
						asUser: "user-2",
					}),
				).rejects.toThrow("User cannot update playlist attributes");
			});
		});

		it("maps members to the client shape from getPlaylistMembers", async () => {
			membersRepository.find.mockResolvedValue([
				{
					playlistUuid: "pl-1",
					userUuid: "user-1",
					role: PlaylistMemberRole.COLLABORATOR,
					dateAdded: "2024-01-01T00:00:00.000Z",
					user: { toSavedResponse: () => ({ uuid: "user-1" }) },
				},
				{
					playlistUuid: "pl-1",
					userUuid: "user-2",
					role: PlaylistMemberRole.VIEWER,
					dateAdded: 1704067200000,
					user: null,
				},
			]);
			const client = service.createPlaylistClient(plugin);

			const members = await client.getPlaylistMembers("pl-1");

			expect(members).toEqual([
				{
					playlistUuid: "pl-1",
					userUuid: "user-1",
					role: "collaborator",
					dateAdded: new Date("2024-01-01T00:00:00.000Z"),
					user: { uuid: "user-1" },
				},
				{
					playlistUuid: "pl-1",
					userUuid: "user-2",
					role: "viewer",
					dateAdded: new Date(1704067200000),
					user: null,
				},
			]);
		});
	});
});
