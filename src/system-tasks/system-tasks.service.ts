import { Injectable } from "@nestjs/common";
import { AlbumManagerService } from "src/album-manager/album-manager.service";
import { ArtistManagerService } from "src/artist-manager/artist-manager.service";
import { IdentifiersService } from "src/identifiers/identifiers.service";
import { LibrariesService } from "src/libraries/libraries.service";
import { TasksService } from "src/tasks/tasks.service";

@Injectable()
export class SystemTasksService {
	constructor(
		private readonly tasksService: TasksService,
		private readonly librariesService: LibrariesService,
		private readonly identifiersService: IdentifiersService,
		private readonly artistManagerService: ArtistManagerService,
		private readonly albumManagerService: AlbumManagerService,
	) {
		this.tasksService.registerSystemTask({
			id: "clean-database",
			resumable: false,
			run: async (ctx) => {
				const tasks: (() => Promise<void>)[] = [
					() => this.librariesService.clearStaleLibraries(),
					() => this.identifiersService.clean(),
					() => this.artistManagerService.cleanIdentities(),
					() => this.albumManagerService.cleanIdentities(),
					() => this.albumManagerService.removeOrphanedAlbums(),
					() => this.artistManagerService.removeOrphanedArtists(),
				];

				for (const [index, callback] of tasks.entries()) {
					await callback();
					ctx.update(index / tasks.length);
				}
			},
		});
	}
}
