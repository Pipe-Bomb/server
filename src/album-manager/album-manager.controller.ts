import { Controller } from "@nestjs/common";
import { AlbumManagerService } from "./album-manager.service";

@Controller()
export class AlbumManagerController {
	constructor(private readonly albumManagerService: AlbumManagerService) {}
}
