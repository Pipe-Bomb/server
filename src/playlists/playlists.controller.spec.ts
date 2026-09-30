/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-argument */
import {
	BadRequestException,
	ForbiddenException,
	NotFoundException,
} from "@nestjs/common";
import { PlaylistsController } from "./playlists.controller";
import { PlaylistVisibility } from "./enum/playlist-visibility.enum";
import { PlaylistMemberRole } from "./enum/playlist-member-role.enum";

jest.mock("src/audio-cache/audio-cache.service", () => ({
	AudioCacheService: class AudioCacheService {},
}));

const makePlaylistInfo = (overrides: Record<string, unknown> = {}) => {
	const playlist: any = {
		uuid: "pl-1",
		ownerUuid: "owner-1",
		visibility: PlaylistVisibility.PUBLIC,
		...overrides,
	};
	return { playlist, trackCount: 0 };
};

describe("PlaylistsController", () => {
	let controller: PlaylistsController;
	let playlistsService: any;
	let smartPlaylistsService: any;
	let attributeSourcesService: any;
	let userManagerService: any;
	let librariesService: any;
	let ephemeralService: any;
	let albumManagerService: any;

	beforeEach(() => {
		playlistsService = {
			create: jest.fn(),
			findForUser: jest.fn().mockResolvedValue([]),
			findByUuid: jest.fn().mockResolvedValue(null),
			findMembers: jest.fn().mockResolvedValue([]),
			findAllTracks: jest.fn().mockResolvedValue([]),
			findTracks: jest.fn().mockResolvedValue([]),
			getMemberRole: jest.fn().mockResolvedValue(null),
			addTracks: jest.fn(),
			removeTracks: jest.fn(),
			delete: jest.fn(),
			updateAttributes: jest.fn().mockResolvedValue([]),
			setVisibility: jest.fn().mockResolvedValue(undefined),
			upsertMember: jest.fn(),
			removeMember: jest.fn(),
		};
		smartPlaylistsService = {
			addFilterGroup: jest.fn(),
			updateFilterGroup: jest.fn(),
			deleteFilterGroup: jest.fn(),
			runFilters: jest.fn(),
		};
		attributeSourcesService = {
			customToAttributeValues: jest.fn(),
		};
		userManagerService = {
			findOne: jest.fn(),
		};
		librariesService = {
			resolveTracks: jest.fn().mockResolvedValue([]),
		};
		ephemeralService = {
			createTracks: jest.fn().mockResolvedValue({
				promise: Promise.resolve([]),
			}),
			getCreationSessionsByPlaylistUuid: jest.fn().mockReturnValue([]),
			toCreationSessionResponse: jest.fn(),
		};
		albumManagerService = {
			findOne: jest.fn().mockResolvedValue(null),
		};

		controller = new PlaylistsController(
			playlistsService,
			smartPlaylistsService,
			{},
			{},
			librariesService,
			ephemeralService,
			albumManagerService,
			attributeSourcesService,
			userManagerService,
		);
	});

	describe("createPlaylist", () => {
		it("creates a playlist with the converted attributes", async () => {
			attributeSourcesService.customToAttributeValues.mockReturnValue([
				{ key: "title", value: "T" },
			]);
			playlistsService.create.mockResolvedValue({
				toResponse: jest.fn(() => "RESP"),
			});

			const result = await controller.createPlaylist(
				{} as any,
				{ uuid: "owner-1" } as any,
			);

			expect(playlistsService.create).toHaveBeenCalledWith(
				{ uuid: "owner-1" },
				null,
				[{ key: "title", value: "T" }],
			);
			expect(result).toBe("RESP");
		});
	});

	describe("getOwnPlaylists", () => {
		it("maps each of the user's playlists to a response", async () => {
			playlistsService.findForUser.mockResolvedValue([
				{ toResponse: jest.fn(() => "A") },
				{ toResponse: jest.fn(() => "B") },
			]);

			await expect(
				controller.getOwnPlaylists({ uuid: "owner-1" } as any),
			).resolves.toEqual(["A", "B"]);
			expect(playlistsService.findForUser).toHaveBeenCalledWith(
				{ uuid: "owner-1" },
				{ withAttributes: true },
			);
		});
	});

	describe("getPlaylist", () => {
		it("throws BadRequest when the track limit is out of range", async () => {
			await expect(controller.getPlaylist("pl-1", 300)).rejects.toThrow(
				BadRequestException,
			);
		});

		it("throws NotFoundException when the playlist does not exist", async () => {
			playlistsService.findByUuid.mockResolvedValue(null);
			await expect(controller.getPlaylist("missing", 0)).rejects.toThrow(
				NotFoundException,
			);
		});

		it("returns a public playlist without requiring a user", async () => {
			const playlist = {
				uuid: "pl-1",
				ownerUuid: "owner-1",
				visibility: PlaylistVisibility.PUBLIC,
				toResponse: jest.fn(() => "RESP"),
			};
			playlistsService.findByUuid.mockResolvedValue({
				playlist,
				trackCount: 3,
			});
			playlistsService.findMembers.mockResolvedValue([
				{ toResponse: jest.fn(() => "MEMBER") },
			]);

			const result = await controller.getPlaylist("pl-1", 0);

			expect(result).toBe("RESP");
			expect(playlist.toResponse).toHaveBeenCalledWith(3, ["MEMBER"]);
		});

		it("throws Forbidden when a private playlist is accessed without a user", async () => {
			playlistsService.findByUuid.mockResolvedValue({
				playlist: {
					uuid: "pl-1",
					ownerUuid: "owner-1",
					visibility: PlaylistVisibility.PRIVATE,
				},
				trackCount: 0,
			});

			await expect(controller.getPlaylist("pl-1", 0)).rejects.toThrow(
				ForbiddenException,
			);
		});
	});

	describe("updatePlaylistAttributes", () => {
		it("throws Forbidden when the caller does not own the playlist", async () => {
			playlistsService.findByUuid.mockResolvedValue(makePlaylistInfo());

			await expect(
				controller.updatePlaylistAttributes(
					"pl-1",
					{ uuid: "other" } as any,
					{} as any,
				),
			).rejects.toThrow(ForbiddenException);
		});

		it("returns upload sessions after updating the owner's attributes", async () => {
			playlistsService.findByUuid.mockResolvedValue(makePlaylistInfo());
			attributeSourcesService.customToAttributeValues.mockReturnValue([
				{ key: "title", value: "New" },
			]);
			playlistsService.updateAttributes.mockResolvedValue([
				{ uuid: "session-1" },
			]);

			const result = await controller.updatePlaylistAttributes(
				"pl-1",
				{ uuid: "owner-1" } as any,
				{ attributes: [] } as any,
			);

			expect(result).toEqual([{ uuid: "session-1" }]);
			expect(playlistsService.updateAttributes).toHaveBeenCalledWith(
				expect.objectContaining({ uuid: "pl-1" }),
				[{ key: "title", value: "New" }],
				null,
				{ uuid: "owner-1" },
			);
		});
	});

	describe("updatePlaylistVisibility", () => {
		it("updates the owner's visibility and returns the refreshed playlist", async () => {
			playlistsService.findByUuid.mockResolvedValue(makePlaylistInfo());
			(controller as any).getPlaylist = jest.fn().mockResolvedValue("RESP");

			await expect(
				controller.updatePlaylistVisibility(
					"pl-1",
					{ uuid: "owner-1" } as any,
					{ visibility: PlaylistVisibility.PUBLIC } as any,
				),
			).resolves.toBe("RESP");
			expect(playlistsService.setVisibility).toHaveBeenCalledWith(
				"pl-1",
				PlaylistVisibility.PUBLIC,
			);
		});
	});

	describe("deletePlaylist", () => {
		it("throws NotFoundException when the playlist does not exist", async () => {
			playlistsService.findByUuid.mockResolvedValue(null);
			await expect(
				controller.deletePlaylist("missing", { uuid: "owner-1" } as any),
			).rejects.toThrow(NotFoundException);
		});

		it("throws Forbidden when the caller is not the owner", async () => {
			playlistsService.findByUuid.mockResolvedValue(makePlaylistInfo());
			await expect(
				controller.deletePlaylist("pl-1", { uuid: "other" } as any),
			).rejects.toThrow(ForbiddenException);
		});

		it("deletes a playlist owned by the caller", async () => {
			const { playlist } = makePlaylistInfo();
			playlistsService.findByUuid.mockResolvedValue({
				playlist,
				trackCount: 0,
			});

			await controller.deletePlaylist("pl-1", { uuid: "owner-1" } as any);
			expect(playlistsService.delete).toHaveBeenCalledWith(playlist);
		});
	});

	describe("getPlaylistMembers", () => {
		it("returns the member responses for the owner", async () => {
			playlistsService.findByUuid.mockResolvedValue(makePlaylistInfo());
			playlistsService.findMembers.mockResolvedValue([
				{ toResponse: jest.fn(() => "MEMBER") },
			]);

			await expect(
				controller.getPlaylistMembers("pl-1", { uuid: "owner-1" } as any),
			).resolves.toEqual(["MEMBER"]);
		});

		it("throws Forbidden for a non-owner without a role", async () => {
			playlistsService.findByUuid.mockResolvedValue(makePlaylistInfo());
			playlistsService.getMemberRole.mockResolvedValue(null);

			await expect(
				controller.getPlaylistMembers("pl-1", { uuid: "other" } as any),
			).rejects.toThrow(ForbiddenException);
		});
	});

	describe("upsertPlaylistMember", () => {
		it("throws BadRequest when the owner targets themselves", async () => {
			playlistsService.findByUuid.mockResolvedValue(makePlaylistInfo());

			await expect(
				controller.upsertPlaylistMember(
					"pl-1",
					"owner-1",
					{ role: "collaborator" } as any,
					{ uuid: "owner-1" } as any,
				),
			).rejects.toThrow(BadRequestException);
		});

		it("throws NotFoundException when the target user does not exist", async () => {
			playlistsService.findByUuid.mockResolvedValue(makePlaylistInfo());
			userManagerService.findOne.mockResolvedValue(null);

			await expect(
				controller.upsertPlaylistMember(
					"pl-1",
					"target-1",
					{ role: "collaborator" } as any,
					{ uuid: "owner-1" } as any,
				),
			).rejects.toThrow(NotFoundException);
		});

		it("upserts a member and returns the response", async () => {
			playlistsService.findByUuid.mockResolvedValue(makePlaylistInfo());
			userManagerService.findOne.mockResolvedValue({ uuid: "target-1" });
			playlistsService.upsertMember.mockResolvedValue({
				toResponse: jest.fn(() => "MEMBER_RESP"),
			});

			await expect(
				controller.upsertPlaylistMember(
					"pl-1",
					"target-1",
					{ role: "collaborator" } as any,
					{ uuid: "owner-1" } as any,
				),
			).resolves.toBe("MEMBER_RESP");
			expect(playlistsService.upsertMember).toHaveBeenCalledWith(
				"pl-1",
				"target-1",
				"collaborator",
			);
		});
	});

	describe("removePlaylistMember", () => {
		it("removes a member when the caller owns the playlist", async () => {
			playlistsService.findByUuid.mockResolvedValue(makePlaylistInfo());

			await controller.removePlaylistMember("pl-1", "target-1", {
				uuid: "owner-1",
			} as any);
			expect(playlistsService.removeMember).toHaveBeenCalledWith(
				"pl-1",
				"target-1",
			);
		});
	});

	describe("addPlaylistSmartFilterGroup", () => {
		it("throws BadRequest when the group has no filters", async () => {
			playlistsService.findByUuid.mockResolvedValue(makePlaylistInfo());

			await expect(
				controller.addPlaylistSmartFilterGroup(
					"pl-1",
					{ filters: [] } as any,
					{ uuid: "owner-1" } as any,
				),
			).rejects.toThrow(BadRequestException);
		});

		it("adds a filter group for the owner", async () => {
			const { playlist } = makePlaylistInfo();
			playlistsService.findByUuid.mockResolvedValue({
				playlist,
				trackCount: 0,
			});

			await controller.addPlaylistSmartFilterGroup(
				"pl-1",
				{ filters: [{ type: "artist" }] } as any,
				{ uuid: "owner-1" } as any,
			);
			expect(smartPlaylistsService.addFilterGroup).toHaveBeenCalledWith(
				playlist,
				[{ type: "artist" }],
			);
		});
	});

	describe("getPlaylist private access", () => {
		it("returns a private playlist to its owner", async () => {
			const playlist = {
				uuid: "pl-1",
				ownerUuid: "owner-1",
				visibility: PlaylistVisibility.PRIVATE,
				toResponse: jest.fn(() => "RESP"),
			};
			playlistsService.findByUuid.mockResolvedValue({
				playlist,
				trackCount: 2,
			});

			const result = await controller.getPlaylist(
				"pl-1",
				0,
				{ uuid: "owner-1" } as any,
			);

			expect(result).toBe("RESP");
			expect(playlist.toResponse).toHaveBeenCalledWith(2, []);
		});

		it("returns a private playlist to a member with a role", async () => {
			const playlist = {
				uuid: "pl-1",
				ownerUuid: "owner-1",
				visibility: PlaylistVisibility.PRIVATE,
				toResponse: jest.fn(() => "RESP"),
			};
			playlistsService.findByUuid.mockResolvedValue({
				playlist,
				trackCount: 1,
			});
			playlistsService.getMemberRole.mockResolvedValue(
				PlaylistMemberRole.VIEWER,
			);
			playlistsService.findMembers.mockResolvedValue([
				{ toResponse: jest.fn(() => "MEMBER") },
			]);

			const result = await controller.getPlaylist(
				"pl-1",
				0,
				{ uuid: "member-1" } as any,
			);

			expect(result).toBe("RESP");
			expect(playlistsService.getMemberRole).toHaveBeenCalledWith(
				"pl-1",
				"member-1",
			);
			expect(playlist.toResponse).toHaveBeenCalledWith(1, ["MEMBER"]);
		});

		it("throws Forbidden for a non-owner without a member role", async () => {
			playlistsService.findByUuid.mockResolvedValue({
				playlist: {
					uuid: "pl-1",
					ownerUuid: "owner-1",
					visibility: PlaylistVisibility.PRIVATE,
				},
				trackCount: 0,
			});
			playlistsService.getMemberRole.mockResolvedValue(null);

			await expect(
				controller.getPlaylist("pl-1", 0, { uuid: "member-1" } as any),
			).rejects.toThrow(ForbiddenException);
		});
	});

	describe("getAllPlaylistTrackIds", () => {
		it("throws NotFoundException when the playlist does not exist", async () => {
			playlistsService.findByUuid.mockResolvedValue(null);

			await expect(controller.getAllPlaylistTrackIds("missing")).rejects.toThrow(
				NotFoundException,
			);
		});

		it("throws Forbidden when a private playlist is accessed without a user", async () => {
			playlistsService.findByUuid.mockResolvedValue({
				playlist: {
					uuid: "pl-1",
					ownerUuid: "owner-1",
					visibility: PlaylistVisibility.PRIVATE,
				},
				trackCount: 0,
			});

			await expect(controller.getAllPlaylistTrackIds("pl-1")).rejects.toThrow(
				ForbiddenException,
			);
		});

		it("maps all of the playlist's tracks to responses", async () => {
			const { playlist } = makePlaylistInfo();
			playlistsService.findByUuid.mockResolvedValue({
				playlist,
				trackCount: 2,
			});
			playlistsService.findAllTracks.mockResolvedValue([
				{ toResponse: jest.fn(() => "T1") },
				{ toResponse: jest.fn(() => "T2") },
			]);

			await expect(
				controller.getAllPlaylistTrackIds("pl-1"),
			).resolves.toEqual(["T1", "T2"]);
			expect(playlistsService.findAllTracks).toHaveBeenCalledWith(playlist);
		});
	});

	describe("getPlaylistTracks", () => {
		it("throws NotFoundException when the playlist does not exist", async () => {
			playlistsService.findByUuid.mockResolvedValue(null);

			await expect(
				controller.getPlaylistTracks("missing", {} as any),
			).rejects.toThrow(NotFoundException);
		});

		it("passes the pagination options and drops null track responses", async () => {
			const { playlist } = makePlaylistInfo();
			playlistsService.findByUuid.mockResolvedValue({
				playlist,
				trackCount: 2,
			});
			playlistsService.findTracks.mockResolvedValue([
				{ toResponse: jest.fn(() => "T1") },
				{ toResponse: jest.fn(() => null) },
			]);

			await expect(
				controller.getPlaylistTracks(
					"pl-1",
					{ offset: 5, amount: 10 } as any,
				),
			).resolves.toEqual(["T1"]);
			expect(playlistsService.findTracks).toHaveBeenCalledWith(
				playlist,
				expect.objectContaining({
					offset: 5,
					amount: 10,
					withTrackArtists: true,
					withTrackAttributes: true,
					withTrackUsers: true,
					withTrackAlbums: true,
				}),
			);
		});
	});

	describe("getPlaylistUpdateProgress", () => {
		it("throws NotFoundException when the playlist does not exist", async () => {
			playlistsService.findByUuid.mockResolvedValue(null);

			await expect(
				controller.getPlaylistUpdateProgress("missing", {
					uuid: "owner-1",
				} as any),
			).rejects.toThrow(NotFoundException);
		});

		it("maps the playlist's creation sessions to responses", async () => {
			playlistsService.findByUuid.mockResolvedValue(makePlaylistInfo());
			ephemeralService.getCreationSessionsByPlaylistUuid.mockReturnValue([
				{ id: "s-1" },
			]);
			ephemeralService.toCreationSessionResponse.mockReturnValue({
				uuid: "s-1",
			});

			await expect(
				controller.getPlaylistUpdateProgress("pl-1", {
					uuid: "owner-1",
				} as any),
			).resolves.toEqual([{ uuid: "s-1" }]);
			expect(
				ephemeralService.getCreationSessionsByPlaylistUuid,
			).toHaveBeenCalledWith("pl-1");
		});
	});

	describe("updatePlaylistTracks", () => {
		beforeEach(() => {
			(controller as any).getPlaylist = jest.fn().mockResolvedValue("RESP");
		});

		it("throws NotFoundException when the playlist does not exist", async () => {
			playlistsService.findByUuid.mockResolvedValue(null);

			await expect(
				controller.updatePlaylistTracks("missing", { uuid: "owner-1" } as any, {} as any),
			).rejects.toThrow(NotFoundException);
		});

		it("throws Forbidden when the caller has no member role", async () => {
			playlistsService.findByUuid.mockResolvedValue(makePlaylistInfo());
			playlistsService.getMemberRole.mockResolvedValue(null);

			await expect(
				controller.updatePlaylistTracks("pl-1", { uuid: "other" } as any, {} as any),
			).rejects.toThrow(ForbiddenException);
		});

		it("allows a collaborator to update the tracks", async () => {
			playlistsService.findByUuid.mockResolvedValue(makePlaylistInfo());
			playlistsService.getMemberRole.mockResolvedValue(
				PlaylistMemberRole.COLLABORATOR,
			);

			const result = await controller.updatePlaylistTracks(
				"pl-1",
				{ uuid: "other" } as any,
				{} as any,
			);

			expect(result).toBe("RESP");
			expect((controller as any).getPlaylist).toHaveBeenCalledWith(
				"pl-1",
				50,
				{ uuid: "other" },
			);
		});

		it("resolves added tracks and queues a session for missing ones", async () => {
			const { playlist } = makePlaylistInfo();
			playlistsService.findByUuid.mockResolvedValue({
				playlist,
				trackCount: 0,
			});
			librariesService.resolveTracks.mockResolvedValue([
				null,
				{ uuid: "t-b" },
			]);
			ephemeralService.createTracks.mockResolvedValue({
				promise: Promise.resolve([{ uuid: "t-a" }]),
			});

			const result = await controller.updatePlaylistTracks(
				"pl-1",
				{ uuid: "owner-1" } as any,
				{ add: { tracks: [{ trackId: "a" }, { trackId: "b" }] } } as any,
			);

			expect(result).toBe("RESP");
			expect(librariesService.resolveTracks).toHaveBeenCalledWith([
				{ trackId: "a" },
				{ trackId: "b" },
			]);
			expect(ephemeralService.createTracks).toHaveBeenCalledWith(
				[{ trackId: "a", index: 0 }],
				{ playlistUuids: ["pl-1"] },
			);
			await new Promise((resolve) => setImmediate(resolve));
			expect(playlistsService.addTracks).toHaveBeenCalledWith(
				playlist,
				[{ uuid: "t-a" }, { uuid: "t-b" }],
				{ uuid: "owner-1" },
			);
		});

		it("adds the tracks of a referenced album by uuid", async () => {
			playlistsService.findByUuid.mockResolvedValue(makePlaylistInfo());
			albumManagerService.findOne.mockResolvedValue({
				tracks: [
					{ track: { uuid: "at-1" } },
					{ track: { uuid: "at-2" } },
				],
			});

			await controller.updatePlaylistTracks(
				"pl-1",
				{ uuid: "owner-1" } as any,
				{ add: { albums: [{ uuid: "alb-1" }] } } as any,
			);

			expect(albumManagerService.findOne).toHaveBeenCalledWith("alb-1", {
				withTracks: true,
			});
			expect(ephemeralService.createTracks).toHaveBeenCalledWith(
				[],
				{ playlistUuids: ["pl-1"] },
			);
		});

		it("throws NotFoundException when a referenced album does not exist", async () => {
			playlistsService.findByUuid.mockResolvedValue(makePlaylistInfo());
			albumManagerService.findOne.mockResolvedValue(null);

			await expect(
				controller.updatePlaylistTracks(
					"pl-1",
					{ uuid: "owner-1" } as any,
					{ add: { albums: [{ uuid: "missing" }] } } as any,
				),
			).rejects.toThrow(NotFoundException);
		});

		it("throws BadRequest when an album has no identifiable information", async () => {
			playlistsService.findByUuid.mockResolvedValue(makePlaylistInfo());

			await expect(
				controller.updatePlaylistTracks(
					"pl-1",
					{ uuid: "owner-1" } as any,
					{ add: { albums: [{ name: "unknown" }] } } as any,
				),
			).rejects.toThrow(BadRequestException);
		});

		it("removes the resolved tracks from the playlist", async () => {
			const { playlist } = makePlaylistInfo();
			playlistsService.findByUuid.mockResolvedValue({
				playlist,
				trackCount: 0,
			});
			librariesService.resolveTracks.mockResolvedValue([
				null,
				{ uuid: "r-1" },
			]);

			await controller.updatePlaylistTracks(
				"pl-1",
				{ uuid: "owner-1" } as any,
				{ remove: [{ trackId: "r-1" }] } as any,
			);

			expect(playlistsService.removeTracks).toHaveBeenCalledWith(
				playlist,
				[{ uuid: "r-1" }],
			);
		});
	});

	describe("updatePlaylistSmartFilterGroup", () => {
		it("throws BadRequest when the group has no filters", async () => {
			playlistsService.findByUuid.mockResolvedValue(makePlaylistInfo());

			await expect(
				controller.updatePlaylistSmartFilterGroup(
					"pl-1",
					"fg-1",
					{ filters: [] } as any,
					{ uuid: "owner-1" } as any,
				),
			).rejects.toThrow(BadRequestException);
		});

		it("updates the filter group for the owner", async () => {
			playlistsService.findByUuid.mockResolvedValue(makePlaylistInfo());

			await controller.updatePlaylistSmartFilterGroup(
				"pl-1",
				"fg-1",
				{ filters: [{ type: "artist" }] } as any,
				{ uuid: "owner-1" } as any,
			);
			expect(smartPlaylistsService.updateFilterGroup).toHaveBeenCalledWith(
				"fg-1",
				"pl-1",
				[{ type: "artist" }],
			);
		});
	});

	describe("deletePlaylistSmartFilterGroup", () => {
		it("throws Forbidden when the caller is not the owner", async () => {
			playlistsService.findByUuid.mockResolvedValue(makePlaylistInfo());

			await expect(
				controller.deletePlaylistSmartFilterGroup(
					"pl-1",
					"fg-1",
					{ uuid: "other" } as any,
				),
			).rejects.toThrow(ForbiddenException);
		});

		it("deletes the filter group for the owner", async () => {
			playlistsService.findByUuid.mockResolvedValue(makePlaylistInfo());

			await controller.deletePlaylistSmartFilterGroup(
				"pl-1",
				"fg-1",
				{ uuid: "owner-1" } as any,
			);
			expect(smartPlaylistsService.deleteFilterGroup).toHaveBeenCalledWith(
				"fg-1",
				"pl-1",
			);
		});
	});

	describe("runPlaylistSmartFilters", () => {
		it("throws NotFoundException when the playlist does not exist", async () => {
			playlistsService.findByUuid.mockResolvedValue(null);

			await expect(
				controller.runPlaylistSmartFilters("missing", { uuid: "owner-1" } as any),
			).rejects.toThrow(NotFoundException);
		});

		it("runs the filters for the owner", async () => {
			playlistsService.findByUuid.mockResolvedValue(makePlaylistInfo());

			await controller.runPlaylistSmartFilters("pl-1", {
				uuid: "owner-1",
			} as any);
			expect(smartPlaylistsService.runFilters).toHaveBeenCalledWith("pl-1");
		});
	});
});
