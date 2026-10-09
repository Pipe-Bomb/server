import { DBAlbum } from "src/albums/entity/album.entity";
import { DBArtist } from "src/artist-manager/entity/artist.entity";
import { DBPlaylist } from "src/playlists/entity/playlist.entity";
import { DBTrack } from "src/tracks/entities/track.entity";
import { DBUser } from "src/users/entity/user.entity";

export type ServerEventMap = {
	"track.added": DBTrack;
	"track.removed": DBTrack;
	"track.identities.updated": DBTrack;
	"track.attributes.updated": DBTrack;
	"track.artists.updated": DBTrack;
	"track.albums.updated": DBTrack;

	"album.added": DBAlbum;
	"album.removed": DBAlbum;
	"album.identities.updated": DBAlbum;
	"album.attributes.updated": DBAlbum;
	"album.tracklist.updated": DBAlbum;
	"album.artists.updated": DBAlbum;

	"artist.added": DBArtist;
	"artist.removed": DBArtist;
	"artist.identities.updated": DBArtist;
	"artist.attributes.updated": DBArtist;

	"playlist.added": DBPlaylist;
	"playlist.removed": DBPlaylist;
	"playlist.attributes.updated": DBPlaylist;
	"playlist.tracklist.updated": DBPlaylist;
	"playlist.visibility.updated": DBPlaylist;
	"playlist.members.updated": DBPlaylist;

	"user.added": DBUser;
};
