import { Injectable, Logger } from "@nestjs/common";
import { LibrariesService } from "./libraries/libraries.service";
import { IdentifiersService } from "./identifiers/identifiers.service";

@Injectable()
export class AppService {
	private readonly logger = new Logger("App");

	constructor(
		private readonly librariesService: LibrariesService,
		private readonly identifiersService: IdentifiersService,
	) {
		// setTimeout(async () => {
		// 	return;
		// 	this.logger.log("Scanning Libraries...");
		// 	const pluginLibs = this.librariesService.all();
		// 	for (const { plugin, libraries } of pluginLibs) {
		// 		for (const library of libraries.values()) {
		// 			try {
		// 				await library.scan();
		// 			} catch (e) {
		// 				this.logger.error(
		// 					`Error while scanning Library "${library.id}" from Plugin "${plugin.package.name}":`,
		// 					e,
		// 				);
		// 			}
		// 		}
		// 	}
		// 	// this.logger.log("Identifying Tracks...");
		// 	// for (const { plugin, libraries } of pluginLibs) {
		// 	// 	for (const library of libraries.values()) {
		// 	// 		await this.identifiersService.identifyLibrary(library, plugin);
		// 	// 	}
		// 	// }
		// 	this.logger.log("Attributing Tracks...");
		// 	for (const { plugin, libraries } of pluginLibs) {
		// 		for (const library of libraries.values()) {
		// 			await this.librariesService.attribute(library);
		// 		}
		// 	}
		// }, 2_000);
	}
}
