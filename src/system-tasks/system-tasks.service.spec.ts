jest.mock("src/audio-cache/audio-cache.service", () => ({
	AudioCacheService: class AudioCacheService {},
}));

import { SimpleTask } from "@sdk";
import { SystemTasksService } from "./system-tasks.service";
import { TasksService } from "src/tasks/tasks.service";
import { LibrariesService } from "src/libraries/libraries.service";
import { IdentifiersService } from "src/identifiers/identifiers.service";
import { ArtistManagerService } from "src/artist-manager/artist-manager.service";
import { AlbumManagerService } from "src/album-manager/album-manager.service";

const mockTasksService = { registerSystemTask: jest.fn() };
const mockLibrariesService = { clearStaleLibraries: jest.fn() };
const mockIdentifiersService = { clean: jest.fn() };
const mockArtistManagerService = {
	cleanIdentities: jest.fn(),
	removeOrphanedArtists: jest.fn(),
};
const mockAlbumManagerService = {
	cleanIdentities: jest.fn(),
	removeOrphanedAlbums: jest.fn(),
};

describe("SystemTasksService", () => {
	let service: SystemTasksService;
	let registeredTask: SimpleTask;

	beforeEach(() => {
		jest.clearAllMocks();
		service = new SystemTasksService(
			mockTasksService as unknown as TasksService,
			mockLibrariesService as unknown as LibrariesService,
			mockIdentifiersService as unknown as IdentifiersService,
			mockArtistManagerService as unknown as ArtistManagerService,
			mockAlbumManagerService as unknown as AlbumManagerService,
		);
		registeredTask = mockTasksService.registerSystemTask.mock.calls[0][0];
	});

	it("registers the clean-database system task on construction", () => {
		expect(mockTasksService.registerSystemTask).toHaveBeenCalledTimes(1);
		expect(registeredTask.id).toBe("clean-database");
		expect(registeredTask.resumable).toBe(false);
	});

	it("runs all cleanup callbacks in order and reports progress", async () => {
		const updates: number[] = [];
		const ctx = {
			update: (percent: number) => updates.push(percent),
			getRunId: () => "run-1",
		};

		await registeredTask.run(ctx);

		expect(mockLibrariesService.clearStaleLibraries).toHaveBeenCalledTimes(1);
		expect(mockIdentifiersService.clean).toHaveBeenCalledTimes(1);
		expect(mockArtistManagerService.cleanIdentities).toHaveBeenCalledTimes(1);
		expect(mockAlbumManagerService.cleanIdentities).toHaveBeenCalledTimes(1);
		expect(mockAlbumManagerService.removeOrphanedAlbums).toHaveBeenCalledTimes(1);
		expect(mockArtistManagerService.removeOrphanedArtists).toHaveBeenCalledTimes(1);
		expect(updates).toEqual([0, 1 / 6, 2 / 6, 3 / 6, 4 / 6, 5 / 6]);
	});

	it("stops and rejects when a cleanup callback fails", async () => {
		mockIdentifiersService.clean.mockRejectedValue(new Error("boom"));
		const ctx = { update: jest.fn(), getRunId: () => "run-1" };

		await expect(registeredTask.run(ctx)).rejects.toThrow("boom");
		expect(mockArtistManagerService.cleanIdentities).not.toHaveBeenCalled();
		expect(mockAlbumManagerService.removeOrphanedAlbums).not.toHaveBeenCalled();
	});
});
