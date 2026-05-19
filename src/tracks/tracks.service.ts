import { Injectable, Logger } from "@nestjs/common";
import { DBTrack } from "./entities/track.entity";
import { IdentifiersService } from "src/identifiers/identifiers.service";
import { ExternalUrlsService } from "src/external-urls/external-urls.service";

@Injectable()
export class TracksService {
	private readonly logger = new Logger("Tracks Service");

	constructor(
		private readonly identifiersService: IdentifiersService,
		private readonly externalUrlsService: ExternalUrlsService,
	) {}

	public async getExternalUrls(track: DBTrack) {
		const identities = (
			await this.identifiersService.getTrackIdentities(track)
		).map((identity) => identity.toIdentity());

		return this.externalUrlsService.getTrackUrls({
			getIdentity: (id, pluginId, multiple) => {
				const matches = identities.filter(
					(identity) =>
						identity.identifierId == id &&
						(!pluginId || pluginId == identity.pluginId),
				);
				if (!matches.length) {
					return null;
				}
				if (multiple) {
					return matches;
				}
				return matches[0]! as any;
			},
		});
	}
}
