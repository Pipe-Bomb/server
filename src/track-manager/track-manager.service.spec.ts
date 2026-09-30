import { TrackManagerService } from "./track-manager.service";
import { In } from "typeorm";
import { AttributeEntity } from "src/attribute-sources/enum/attribute-entity.enum";
import { AttributeType } from "src/attributes/enum/attribute-type.enum";
import { BadRequestException } from "@nestjs/common";
import { Repository } from "typeorm";
import { WorkflowsService } from "../workflows/workflows.service";
import { LoadedPlugin } from "../plugins/interface/loaded-plugin.interface";
import { LibraryHandler } from "@sdk";
import { Track } from "@sdk";

class MockQueryBuilder {
  selectCalls: any[] = [];
  subQueryCalls: any[] = [];
  fromCalls: any[] = [];
  innerJoinCalls: any[] = [];
  whereCalls: any[] = [];
  andWhereCalls: any[] = [];
  setParameterCalls: any[] = [];
  limitCalls: any[] = [];
  rawResults: any[] = [];

  select(...args: any[]) { this.selectCalls.push(args); return this; }
  subQuery() { this.subQueryCalls.push([]); return this; }
  from(...args: any[]) { this.fromCalls.push(args); return this; }
  innerJoin(...args: any[]) { this.innerJoinCalls.push(args); return this; }
  where(...args: any[]) { this.whereCalls.push(args); return this; }
  andWhere(...args: any[]) { this.andWhereCalls.push(args); return this; }
  setParameter(key: string, value: any) { this.setParameterCalls.push([key, value]); return this; }
  limit(...args: any[]) { this.limitCalls.push(args); return this; }
  getRawMany() { return Promise.resolve(this.rawResults); }
  getQuery() { return "mockSubQuery"; }
}

class MockRepository implements Partial<Repository<any>> {
  find = jest.fn();
  findOne = jest.fn();
  countBy = jest.fn();
  deleteAll = jest.fn();
  update = jest.fn();
  upsert = jest.fn();
  delete = jest.fn();
  insert = jest.fn();
  create = jest.fn();
  createQueryBuilder = jest.fn();
}

class MockWorkflowsService implements Partial<WorkflowsService> {
  registerStep = jest.fn();
}

const mockRepo = new MockRepository() as any;
const mockWorkflow = new MockWorkflowsService() as any;
let service: TrackManagerService;

const plugin: LoadedPlugin = { package: { name: "plugin" } } as any;
const library: LibraryHandler = { id: "lib" } as any;
const track: Track = { id: "track1", title: "Title" } as any;

describe("TrackManagerService", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    service = new TrackManagerService(mockRepo, mockWorkflow);
  });

  it("registers workflow step on construction", () => {
    expect(mockWorkflow.registerStep).toHaveBeenCalled();
  });

  it("addTrack with runId calls upsert with conflictPaths", async () => {
    const runId = "run1";
    await service.addTrack(plugin, library, track, runId);
    expect(mockRepo.upsert).toHaveBeenCalledWith(
      {
        pluginId: plugin.package.name,
        libraryId: library.id,
        trackId: track.id,
        title: track.title,
        lastScanRunId: runId,
      },
      {
        conflictPaths: ["pluginId", "libraryId", "trackId"],
        skipUpdateIfNoValuesChanged: true,
      },
    );
  });

  it("addTrack without runId calls upsert with array keys", async () => {
    await service.addTrack(plugin, library, track, null);
    expect(mockRepo.upsert).toHaveBeenCalledWith(
      {
        pluginId: plugin.package.name,
        libraryId: library.id,
        trackId: track.id,
        title: track.title,
        lastScanRunId: null,
      },
      ["pluginId", "libraryId", "trackId"],
    );
  });

  it("listeners are called on addTrack", async () => {
    const counter = { value: 0 };
    const listener = () => {
      counter.value++;
    };
    (service as any).addTrackListeners.add(listener);
    await service.addTrack(plugin, library, track, null);
    expect(counter.value).toBe(1);
  });

  it("addTracks inserts new tracks and returns output", async () => {
    const newTrack: Track = { id: "new1", title: "New" } as any;
    const existingTrack: Track = { id: "track1", title: "Title" } as any;

    // Mock repository.find to return existing track
    mockRepo.find = jest.fn().mockResolvedValue([
      { pluginId: plugin.package.name, libraryId: library.id, trackId: existingTrack.id, title: existingTrack.title },
    ]);
    // Mock repository.create to return track objects
    mockRepo.create = jest.fn().mockImplementation((tracks: any[]) => tracks);
    // Mock repository.insert
    mockRepo.insert = jest.fn().mockResolvedValue(undefined);

    const output = await service.addTracks(plugin, library, [newTrack, existingTrack]);

    expect(mockRepo.find).toHaveBeenCalled();
    expect(mockRepo.create).toHaveBeenCalled();
    expect(mockRepo.insert).toHaveBeenCalled();
    expect(output.length).toBe(2);
    const titles = output.map((t: any) => t.title);
    expect(titles).toContain("New");
    expect(titles).toContain("Title");
  });

  it("deleteAll calls repository.deleteAll", async () => {
    await service.deleteAll();
    expect(mockRepo.deleteAll).toHaveBeenCalled();
  });

  it("setRunId updates tracks correctly", async () => {
    const tracks = [
      { uuid: "uuid1" },
      { uuid: "uuid2" },
    ];
    await service.setRunId(tracks as any, "runX", "attribute");
    expect(mockRepo.update).toHaveBeenCalled();
  });
// ------------------------------------------------------------------
// Additional tests to increase coverage
// ------------------------------------------------------------------

it("find, findOne, count, queryBuilder, and deleteAll are forwarded to repository", async () => {
  mockRepo.find = jest.fn().mockResolvedValue([]);
  mockRepo.findOne = jest.fn().mockResolvedValue(null);
  mockRepo.countBy = jest.fn().mockResolvedValue(0);
  mockRepo.createQueryBuilder = jest.fn().mockReturnValue({} as any);
  mockRepo.deleteAll = jest.fn().mockResolvedValue(undefined);

  await service.find({ where: { title: "foo" } as any });
  await service.findOne({ where: { uuid: "foo" } as any });
  await service.count({ uuid: "foo" } as any);
  await service.queryBuilder("track");
  await service.deleteAll();

  expect(mockRepo.find).toHaveBeenCalled();
  expect(mockRepo.findOne).toHaveBeenCalled();
  expect(mockRepo.countBy).toHaveBeenCalled();
  expect(mockRepo.createQueryBuilder).toHaveBeenCalled();
  expect(mockRepo.deleteAll).toHaveBeenCalled();
});

it("setRunId with identity type updates correctly", async () => {
  const tracks = [{ uuid: "uuid1" } as any];
  await service.setRunId(tracks, "runY", "identity");
  expect(mockRepo.update).toHaveBeenCalled();
  const [where, partial] = mockRepo.update.mock.calls[0];
  expect(where).toHaveProperty("uuid");
  expect(partial).toHaveProperty("lastIdentificationRunId", "runY");
});

it("removeTracks splits trackIds into chunks and calls delete correctly", async () => {
  const ids = Array.from({ length: 2500 }, (_, i) => `track${i}`);
  mockRepo.delete = jest.fn().mockResolvedValue(undefined);
  await service.removeTracks(plugin, library, ids);
  // 2500 ids => 3 chunks: 0-999, 1000-1999, 2000-2499
  expect(mockRepo.delete).toHaveBeenCalledTimes(3);
  mockRepo.delete.mock.calls.forEach((call) => {
    const args = call[0];
    expect(args).toHaveProperty("pluginId", plugin.package.name);
    expect(args).toHaveProperty("libraryId", library.id);
    expect(args).toHaveProperty("trackId");
  });
});

it("addTracks throws when repository returns track not in input ids", async () => {
  const newTrack: Track = { id: "new1", title: "New" } as any;
  // repository returns a track with trackId that is not in input ids
  mockRepo.find = jest.fn().mockResolvedValue([
    { pluginId: plugin.package.name, libraryId: library.id, trackId: "invalid", title: "X" },
  ]);
  await expect(
    service.addTracks(plugin, library, [newTrack]),
  ).rejects.toThrow("Invalid track returned");
});

it("addTracks throws when created track has wrong id", async () => {
  const newTrack: Track = { id: "new1", title: "New" } as any;
  mockRepo.find = jest.fn().mockResolvedValue([]);
  // create returns a track with trackId that is not in input ids
  mockRepo.create = jest.fn().mockReturnValue([{ trackId: "invalid" }]);
  await expect(
    service.addTracks(plugin, library, [newTrack]),
  ).rejects.toThrow("Invalid track created");
});

it("findTracksBySmartFilters returns ids and respects limit", async () => {
  // Prepare mock query builder
  const qb = new MockQueryBuilder();
  qb.rawResults = [{ id: "uuid1" }, { id: "uuid2" }];
  mockRepo.createQueryBuilder = jest.fn().mockReturnValue(qb);

  const filter: any = {
    entityType: AttributeEntity.TRACK,
    attributeKey: "key1",
    attributeType: AttributeType.STRING,
    value_string: "value",
    partial: false,
    inverse: false,
    value_boolean: null,
    value_int: null,
    value_decimal: null,
    min: null,
    max: null,
  };
  const group = { filters: [filter] };
  const result = await service.findTracksBySmartFilters([group], 5);
  expect(result).toEqual(["uuid1", "uuid2"]);
  // limit should have been called with amount
  expect(qb.limitCalls).toHaveLength(1);
  expect(qb.limitCalls[0][0]).toBe(5);
});

it("findTracksBySmartFilters returns empty array when no filters", async () => {
  const result = await service.findTracksBySmartFilters([], undefined);
  expect(result).toEqual([]);
});

it("findTracksBySmartFilters returns empty array when group filters empty", async () => {
  const group = { filters: [] };
  const result = await service.findTracksBySmartFilters([group], undefined);
  expect(result).toEqual([]);
});

it("findTracksBySmartFilters throws BadRequestException for unsupported entity type", async () => {
  const filter: any = {
    entityType: "invalid" as any,
    attributeKey: "key",
    attributeType: AttributeType.STRING,
    value_string: "value",
    partial: false,
    inverse: false,
    value_boolean: null,
    value_int: null,
    value_decimal: null,
    min: null,
    max: null,
  };
  const group = { filters: [filter] };
  await expect(
    service.findTracksBySmartFilters([group], undefined),
  ).rejects.toThrow(BadRequestException);
});

});

