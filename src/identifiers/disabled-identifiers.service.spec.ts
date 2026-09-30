import { DisabledIdentifiersService } from "./disabled-identifiers.service";
import { IdentifierType } from "./enum/identifier-type.enum";

describe("DisabledIdentifiersService", () => {
  let service: DisabledIdentifiersService;
  let mockRepo: any;

  beforeEach(() => {
    mockRepo = {
      find: jest.fn(),
      upsert: jest.fn(),
      delete: jest.fn(),
    };
    service = new DisabledIdentifiersService(mockRepo as any);
  });

  describe("getDisabledSet", () => {
    it("returns a set of disabled identifiers", async () => {
      mockRepo.find.mockResolvedValue([
        { pluginId: "plug1", identifierId: "id1", type: IdentifierType.Track },
        { pluginId: "plug2", identifierId: "id2", type: IdentifierType.Artist },
      ]);
      const set = await service.getDisabledSet();
      expect(set.has("plug1:id1:track")).toBe(true);
      expect(set.has("plug2:id2:artist")).toBe(true);
      expect(set.size).toBe(2);
    });

    it("returns an empty set when no rows are found", async () => {
      mockRepo.find.mockResolvedValue([]);
      const set = await service.getDisabledSet();
      expect(set.size).toBe(0);
    });
  });

  describe("disableIdentifiers", () => {
    it("does nothing when the list is empty", async () => {
      await service.disableIdentifiers([]);
      expect(mockRepo.upsert).not.toHaveBeenCalled();
    });

    it("calls upsert with items and correct options", async () => {
      const items = [
        { pluginId: "plug1", identifierId: "id1", type: IdentifierType.Track },
        { pluginId: "plug2", identifierId: "id2", type: IdentifierType.Artist },
      ];
      await service.disableIdentifiers(items);
      expect(mockRepo.upsert).toHaveBeenCalledWith(items, {
        conflictPaths: ["pluginId", "identifierId", "type"],
        skipUpdateIfNoValuesChanged: true,
      });
    });
  });

  describe("enableIdentifiers", () => {
    it("does nothing when the list is empty", async () => {
      await service.enableIdentifiers([]);
      expect(mockRepo.delete).not.toHaveBeenCalled();
    });

    it("calls delete with conditions array", async () => {
      const items = [
        { pluginId: "plug1", identifierId: "id1", type: IdentifierType.Track },
        { pluginId: "plug2", identifierId: "id2", type: IdentifierType.Artist },
      ];
      await service.enableIdentifiers(items);
      expect(mockRepo.delete).toHaveBeenCalledWith([
        { pluginId: "plug1", identifierId: "id1", type: IdentifierType.Track },
        { pluginId: "plug2", identifierId: "id2", type: IdentifierType.Artist },
      ]);
    });
  });
});
