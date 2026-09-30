import { DBTrack } from "./track.entity";

// Simple mock classes to satisfy the methods used in DBTrack
class MockIdentity {
    constructor(public identityId: string, public pluginId: string, public identity: string) {}
    toResponse() {
        return {
            pluginId: this.pluginId,
            identityId: this.identityId,
            value: this.identity,
            ordinal: 0,
        };
    }
    toIdentity() {
        return {
            identityId: this.identityId,
            pluginId: this.pluginId,
            identity: this.identity,
        };
    }
}

class MockArtist {
    constructor(public uuid: string, public name: string) {}
    toResponse() {
        return { uuid: this.uuid, name: this.name };
    }
    toSavedResponse() {
        return { uuid: this.uuid, name: this.name };
    }
}

class MockAttribute {
    constructor(public key: string, public value: any) {}
    toResponse() {
        return { key: this.key, values: [this.value] };
    }
    toSavedAttribute() {
        return { key: this.key, values: [this.value], pluginId: "plugin", sourceId: "source", type: "string" };
    }
}

class MockAlbum {
    constructor(public uuid: string, public title: string) {}
    toResponse() {
        return { uuid: this.uuid, title: this.title };
    }
    toSavedResponse() {
        return { uuid: this.uuid, title: this.title };
    }
}

// Helper to create a DBTrackArtist-like object
function createTrackArtist(artist: any, joinPhrase: string | null = null): any {
    return {
        artist,
        joinPhrase,
        artistUuid: artist ? artist.uuid : "artist-uuid",
        trackUuid: "track-uuid",
        ordinal: 0,
        pluginId: "plugin",
        identifierId: "id",
        toResponse() {
            if (!this.artist) {
                return null;
            }
            return {
                artistUuid: this.artistUuid,
                joinPhrase: this.joinPhrase,
                artist: this.artist.toResponse(),
            };
        },
        toSavedResponse() {
            return {
                artistUuid: this.artistUuid,
                trackUuid: this.trackUuid,
                pluginId: this.pluginId,
                identifierId: this.identifierId,
                ordinal: this.ordinal,
                joinPhrase: this.joinPhrase,
                artist: this.artist ? this.artist.toSavedResponse() : null,
                track: null,
            };
        },
    } as any;
}

// Helper to create a DBAlbumTrack-like object
function createAlbumTrack(album: any): any {
    return {
        album,
        albumUuid: album ? album.uuid : "album-uuid",
        trackUuid: "track-uuid",
        discNumber: 1,
        trackNumber: 1,
        pluginId: "plugin",
        identifierId: "id",
        toSavedResponse() {
            return {
                albumUuid: this.albumUuid,
                trackUuid: this.trackUuid,
                discNumber: this.discNumber,
                trackNumber: this.trackNumber,
                pluginId: this.pluginId,
                identifierId: this.identifierId,
                album: this.album ? this.album.toSavedResponse() : null,
                track: null,
            };
        },
    } as any;
}

describe("DBTrack", () => {
    const baseDate = 1640995200000; // Jan 1 2022

    it("toResponse returns identities from options when provided", () => {
        const track = new DBTrack();
        track.pluginId = "pluginA";
        track.libraryId = "lib1";
        track.trackId = "t1";
        track.uuid = "uuid1";
        track.title = "Song";
        track.dateAdded = baseDate;
        // this.identities contains identityA
        const identityA = new MockIdentity("idA", "pluginA", "identityA");
        track.identities = [identityA];
        // options.identities contains identityB
        const identityB = new MockIdentity("idB", "pluginB", "identityB");
        const res = track.toResponse({ identities: [identityB] });
        expect(res.identities).toEqual([identityB.toResponse()]);
    });

    it("toResponse uses this.identities when options not provided", () => {
        const track = new DBTrack();
        track.pluginId = "pluginA";
        track.libraryId = "lib1";
        track.trackId = "t1";
        track.uuid = "uuid1";
        track.title = "Song";
        track.dateAdded = baseDate;
        const identityA = new MockIdentity("idA", "pluginA", "identityA");
        track.identities = [identityA];
        const res = track.toResponse();
        expect(res.identities).toEqual([identityA.toResponse()]);
    });

    it("toResponse returns null identities when none", () => {
        const track = new DBTrack();
        track.pluginId = "pluginA";
        track.libraryId = "lib1";
        track.trackId = "t1";
        track.uuid = "uuid1";
        track.title = "Song";
        track.dateAdded = baseDate;
        const res = track.toResponse();
        expect(res.identities).toBeNull();
    });

    it("toResponse filters artists correctly based on joinPhrase", () => {
        const track = new DBTrack();
        track.pluginId = "pluginA";
        track.libraryId = "lib1";
        track.trackId = "t1";
        track.uuid = "uuid1";
        track.title = "Song";
        track.dateAdded = baseDate;

        const artist1 = new MockArtist("uuid1", "Artist1");
        const artist2 = new MockArtist("uuid1", "Artist1"); // same uuid
        const artist3 = new MockArtist("uuid2", "Artist2");

        // artist1 with joinPhrase, artist2 without joinPhrase (should be skipped)
        const ta1 = createTrackArtist(artist1, "feat");
        const ta2 = createTrackArtist(artist2, null);
        // artist3 with no conflict
        const ta3 = createTrackArtist(artist3, null);

        track.artists = [ta1, ta2, ta3];
        const res = track.toResponse();
        const artistResponses = res.artists as any;
        expect(artistResponses).toHaveLength(2);
        const uuids = artistResponses.map((a: any) => a.artistUuid);
        expect(uuids).toContain("uuid1");
        expect(uuids).toContain("uuid2");
        // ensure joinPhrase from first artist kept
        const artist1Resp = artistResponses.find((a: any) => a.artistUuid === "uuid1");
        expect(artist1Resp.joinPhrase).toBe("feat");
    });

    it("toResponse overrides artist when new has joinPhrase", () => {
        const track = new DBTrack();
        track.pluginId = "pluginA";
        track.libraryId = "lib1";
        track.trackId = "t1";
        track.uuid = "uuid1";
        track.title = "Song";
        track.dateAdded = baseDate;

        const artist1 = new MockArtist("uuid1", "Artist1");
        const artist2 = new MockArtist("uuid1", "Artist1");
        const ta1 = createTrackArtist(artist1, null); // no joinPhrase
        const ta2 = createTrackArtist(artist2, "and"); // has joinPhrase
        track.artists = [ta1, ta2];
        const res = track.toResponse();
        const artistResponses = res.artists as any;
        const artist1Resp = artistResponses.find((a: any) => a.artistUuid === "uuid1");
        expect(artist1Resp.joinPhrase).toBe("and");
    });

    it("toResponse skips artists with no artist object", () => {
        const track = new DBTrack();
        track.pluginId = "pluginA";
        track.libraryId = "lib1";
        track.trackId = "t1";
        track.uuid = "uuid1";
        track.title = "Song";
        track.dateAdded = baseDate;
        const ta1 = createTrackArtist(null, "feat"); // artist null
        track.artists = [ta1];
        const res = track.toResponse();
        expect(res.artists).toEqual([]);
    });

    it("toResponse includes albums when present", () => {
        const track = new DBTrack();
        track.pluginId = "pluginA";
        track.libraryId = "lib1";
        track.trackId = "t1";
        track.uuid = "uuid1";
        track.title = "Song";
        track.dateAdded = baseDate;
        const album1 = new MockAlbum("album1", "Album One");
        const album2 = new MockAlbum("album2", "Album Two");
        const at1 = createAlbumTrack(album1);
        const at2 = createAlbumTrack(album2);
        track.albums = [at1, at2];
        const res = track.toResponse();
        expect(res.albums).toHaveLength(2);
        const titles = res.albums.map((a: any) => a.title);
        expect(titles).toContain("Album One");
        expect(titles).toContain("Album Two");
    });

    it("toResponse skips album with null album", () => {
        const track = new DBTrack();
        track.pluginId = "pluginA";
        track.libraryId = "lib1";
        track.trackId = "t1";
        track.uuid = "uuid1";
        track.title = "Song";
        track.dateAdded = baseDate;
        const at1 = createAlbumTrack(null); // album null
        track.albums = [at1];
        const res = track.toResponse();
        expect(res.albums).toEqual([]);
    });

    it("toResponse converts dateAdded to Date", () => {
        const track = new DBTrack();
        track.pluginId = "pluginA";
        track.libraryId = "lib1";
        track.trackId = "t1";
        track.uuid = "uuid1";
        track.title = "Song";
        track.dateAdded = baseDate;
        const res = track.toResponse();
        expect(res.dateAdded instanceof Date).toBe(true);
        expect(res.dateAdded.getTime()).toBe(baseDate);
    });

    it("toResponse handles attributes array correctly", () => {
        const track = new DBTrack();
        track.pluginId = "pluginA";
        track.libraryId = "lib1";
        track.trackId = "t1";
        track.uuid = "uuid1";
        track.title = "Song";
        track.dateAdded = baseDate;
        const attr1 = new MockAttribute("key1", 123);
        const attr2 = new MockAttribute("key2", "value");
        track.attributes = [attr1, attr2];
        const res = track.toResponse();
        // toResponse passes the raw attribute entities through unmapped
        expect(res.attributes).toHaveLength(2);
        expect(res.attributes).toEqual([attr1, attr2]);
    });

    it("toResponse returns null for attributes when none", () => {
        const track = new DBTrack();
        track.pluginId = "pluginA";
        track.libraryId = "lib1";
        track.trackId = "t1";
        track.uuid = "uuid1";
        track.title = "Song";
        track.dateAdded = baseDate;
        const res = track.toResponse();
        expect(res.attributes).toBeNull();
    });

    it("toSavedResponse maps identities, attributes, artists, albums correctly", () => {
        const track = new DBTrack();
        track.pluginId = "pluginA";
        track.libraryId = "lib1";
        track.trackId = "t1";
        track.uuid = "uuid1";
        track.title = "Song";
        track.dateAdded = baseDate;
        const identityA = new MockIdentity("idA", "pluginA", "identityA");
        track.identities = [identityA];
        const attr1 = new MockAttribute("key1", 123);
        track.attributes = [attr1];
        const artist1 = new MockArtist("uuid1", "Artist1");
        track.artists = [createTrackArtist(artist1, null)];
        const album1 = new MockAlbum("album1", "Album One");
        track.albums = [createAlbumTrack(album1)];
        const res = track.toSavedResponse();
        expect(res.identities).toEqual([identityA.toIdentity()]);
        expect(res.attributes).toEqual([attr1.toSavedAttribute()]);
        expect(res.artists).toEqual([track.artists[0].toSavedResponse()]);
        expect(res.albums).toEqual([track.albums[0].toSavedResponse()]);
        expect(res.dateAdded instanceof Date).toBe(true);
        expect(res.dateAdded.getTime()).toBe(baseDate);
    });
});
