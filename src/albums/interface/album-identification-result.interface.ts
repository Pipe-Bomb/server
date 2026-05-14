import { DBAlbumIdentity } from "../entity/album-identity.entity";

export interface AlbumIdentificationResult {
	mergedAlbums: string[];
	identities: DBAlbumIdentity[];
}
