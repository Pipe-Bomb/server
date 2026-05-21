import { DBArtistIdentity } from "../entity/artist-identity.entity";

export interface ArtistIdentificationResult {
	mergedArtists: string[];
	identities: DBArtistIdentity[];
}
