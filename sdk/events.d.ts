import {
	SavedAlbum,
	SavedArtist,
	SavedPlaylist,
	SavedTrack,
	SavedUser,
} from "./database";

export type EventMap = {
	"track-added": [SavedTrack];
	"track-removed": [SavedTrack];
	"track-identities-updated": [SavedTrack];
	"track-attributes-updated": [SavedTrack];
	"track-artists-updated": [SavedTrack];
	"track-albums-updated": [SavedTrack];

	"album-added": [SavedAlbum];
	"album-removed": [SavedAlbum];
	"album-identities-updated": [SavedAlbum];
	"album-attributes-updated": [SavedAlbum];
	"album-tracklist-updated": [SavedAlbum];
	"album-artists-updated": [SavedAlbum];

	"artist-added": [SavedArtist];
	"artist-removed": [SavedArtist];
	"artist-identities-updated": [SavedArtist];
	"artist-attributes-updated": [SavedArtist];

	"playlist-added": [SavedPlaylist];
	"playlist-removed": [SavedPlaylist];
	"playlist-attributes-updated": [SavedPlaylist];
	"playlist-tracklist-updated": [SavedPlaylist];
	"playlist-visibility-updated": [SavedPlaylist];
	"playlist-members-updated": [SavedPlaylist];
	"playlist-filters-updated": [SavedPlaylist];

	"user-added": [SavedUser];
};
