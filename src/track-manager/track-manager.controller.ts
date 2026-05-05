import { Controller } from "@nestjs/common";
import { TrackManagerService } from "./track-manager.service";

@Controller()
export class TrackManagerController {
	constructor(private readonly trackManagerService: TrackManagerService) {}
}
