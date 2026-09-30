import { TracksService } from "./tracks.service";
import { IdentifiersService } from "src/identifiers/identifiers.service";
import { ExternalUrlsService } from "src/external-urls/external-urls.service";
import { DBTrack } from "./entities/track.entity";

describe("TracksService", () => {
  let service: TracksService;
  const mockIdentifiersService = {
    getTrackIdentities: jest.fn(),
  };
  const mockExternalUrlsService = {
    getTrackUrls: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    service = new TracksService(
      mockIdentifiersService as any,
      mockExternalUrlsService as any,
    );
  });

  describe("getExternalUrls", () => {
    const track = {
      pluginId: "pluginA",
      libraryId: "lib1",
      trackId: "t1",
      uuid: "uuid123",
    } as DBTrack;

    it("returns identity based on identityId and pluginId", async () => {
      const identityA = {
        identityId: "id1",
        pluginId: "pluginA",
        toIdentity: () => ({
          identityId: "id1",
          pluginId: "pluginA",
          identity: "id1",
        }),
      };
      const identityB = {
        identityId: "id2",
        pluginId: "pluginB",
        toIdentity: () => ({
          identityId: "id2",
          pluginId: "pluginB",
          identity: "id2",
        }),
      };
      mockIdentifiersService.getTrackIdentities.mockResolvedValue([
        identityA,
        identityB,
      ]);
      mockExternalUrlsService.getTrackUrls.mockImplementation((helper) => helper);

      const helper = await service.getExternalUrls(track);
      expect(mockIdentifiersService.getTrackIdentities).toHaveBeenCalledWith(
        track,
      );
      expect(mockExternalUrlsService.getTrackUrls).toHaveBeenCalled();

      // Helper should have getIdentity, getPluginId, getLibraryId, getTrackId, getTrackUuid
      expect(helper.getPluginId()).toBe(track.pluginId);
      expect(helper.getLibraryId()).toBe(track.libraryId);
      expect(helper.getTrackId()).toBe(track.trackId);
      expect(helper.getTrackUuid()).toBe(track.uuid);

      // identityId only
      const resA = helper.getIdentity("id1");
      expect(resA).toEqual(identityA.toIdentity());
      const resB = helper.getIdentity("id2");
      expect(resB).toEqual(identityB.toIdentity());

      // non-existing id
      expect(helper.getIdentity("nonexistent")).toBeNull();

      // pluginId filtering
      expect(helper.getIdentity("id1", "pluginA")).toEqual(
        identityA.toIdentity(),
      );
      expect(helper.getIdentity("id1", "pluginB")).toBeNull();
    });

    it("handles multiple identities correctly", async () => {
      const identity1a = {
        identityId: "id1",
        pluginId: "pluginA",
        toIdentity: () => ({
          identityId: "id1",
          pluginId: "pluginA",
          identity: "id1",
        }),
      };
      const identity1b = {
        identityId: "id1",
        pluginId: "pluginB",
        toIdentity: () => ({
          identityId: "id1",
          pluginId: "pluginB",
          identity: "id1",
        }),
      };
      mockIdentifiersService.getTrackIdentities.mockResolvedValue([
        identity1a,
        identity1b,
      ]);
      mockExternalUrlsService.getTrackUrls.mockImplementation((helper) => helper);

      const helper = await service.getExternalUrls(track);
      // multiple true should return array of both
      const allIds = helper.getIdentity("id1", undefined, true);
      expect(allIds).toEqual([identity1a.toIdentity(), identity1b.toIdentity()]);
      // multiple false should return first match
      const firstId = helper.getIdentity("id1", undefined, false);
      expect(firstId).toEqual(identity1a.toIdentity());
    });

    it("returns empty identity list when track has no identities", async () => {
      mockIdentifiersService.getTrackIdentities.mockResolvedValue([]);
      mockExternalUrlsService.getTrackUrls.mockImplementation((helper) => helper);

      const helper = await service.getExternalUrls(track);
      expect(helper.getIdentity("id1")).toBeNull();
      // no matches -> null even when multiple is requested
      expect(helper.getIdentity("id1", undefined, true)).toBeNull();
    });
  });
});
