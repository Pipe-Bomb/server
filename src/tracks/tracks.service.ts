import { Injectable, Logger } from "@nestjs/common";

@Injectable()
export class TracksService {
	private readonly logger = new Logger("Tracks Service");
}
