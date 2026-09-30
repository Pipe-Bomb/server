import { SearchSourcesService } from "./search-sources.service";
import { Repository } from "typeorm";
import { BadRequestException, NotFoundException } from "@nestjs/common";
import { DBSearchConfig } from "./entity/search-config.entity";
import { SearchSource, SearchSourceInfo, SearchSourceResults, SearchQuery } from "@sdk";

class MockRepository implements Partial<Repository<DBSearchConfig>> {
  async findOne(options: any) {
    return { id: 1, activePluginId: null, activeSourceId: null };
  }
  async save(entity: any) {
    return entity;
  }
}

class MockSearchSource implements SearchSource {
  id = "source1";
  enable(options: any) {}
  getName() {
    return "Test Source";
  }
  getCapabilities(entities: any) {
    return {
      sortMethods: [{ key: "name", label: "Name" }],
      filterableAttributes: [{ entityType: "track", attributeKey: "title", attributeType: "string" }],
    };
  }
  search(query: SearchQuery): SearchSourceResults {
    return { results: [] } as any;
  }
}

describe("SearchSourcesService", () => {
  const repo = new MockRepository() as any;
  const service = new SearchSourcesService(repo);

  beforeEach(() => {
    // reset activeSource
    (service as any).activeSource = null;
    (service as any).sources.clear();
  });

  it("registers a new source", () => {
    const plugin = { package: { name: "plugin1" } } as any;
    const source = new MockSearchSource();
    service.register(source, plugin);
    const registered = service.getSource("plugin1", "source1");
    expect(registered).toBe(source);
  });

  it("throws error on duplicate registration", () => {
    const plugin = { package: { name: "plugin1" } } as any;
    const source = new MockSearchSource();
    service.register(source, plugin);
    expect(() => service.register(source, plugin)).toThrow();
  });

  it("hasSource returns true when source exists", () => {
    const plugin = { package: { name: "plugin1" } } as any;
    const source = new MockSearchSource();
    service.register(source, plugin);
    expect(service.hasSource()).toBe(true);
  });

  it("getAllSources returns all registered sources", () => {
    const plugin = { package: { name: "plugin1" } } as any;
    const source = new MockSearchSource();
    service.register(source, plugin);
    const all = service.getAllSources();
    expect(all.length).toBe(1);
    expect(all[0].pluginId).toBe("plugin1");
    expect(all[0].sourceId).toBe("source1");
  });

  it("getAll returns summary with active flag", () => {
    const plugin = { package: { name: "plugin1" } } as any;
    const source = new MockSearchSource();
    service.register(source, plugin);
    // manually set active
    (service as any).activeSource = { pluginId: "plugin1", sourceId: "source1" };
    const all = service.getAll();
    expect(all[0].active).toBe(true);
  });

  it("setActive sets active source and saves config", async () => {
    const plugin = { package: { name: "plugin1" } } as any;
    const source = new MockSearchSource();
    service.register(source, plugin);
    await service.setActive("plugin1", "source1");
    expect((service as any).activeSource).toEqual({ pluginId: "plugin1", sourceId: "source1" });
  });

  it("clearActive clears active source and saves config", async () => {
    (service as any).activeSource = { pluginId: "plugin1", sourceId: "source1" };
    await service.clearActive();
    expect((service as any).activeSource).toBeNull();
  });

  it("search delegates to active source", async () => {
    const plugin = { package: { name: "plugin1" } } as any;
    const source = new MockSearchSource();
    service.register(source, plugin);
    await service.setActive("plugin1", "source1");
    const query: any = { entities: { tracks: true }, sort: { key: "name" } };
    const results = await service.search(query);
    expect(results).toEqual({ results: [] } as any);
  });

  it("search throws if sort key unsupported", async () => {
    const plugin = { package: { name: "plugin1" } } as any;
    const source = new MockSearchSource();
    service.register(source, plugin);
    await service.setActive("plugin1", "source1");
    const query: any = { entities: { tracks: true }, sort: { key: "unknown" } };
    await expect(service.search(query)).rejects.toThrow(BadRequestException);
  });

  it("search throws if filter not supported", async () => {
    const plugin = { package: { name: "plugin1" } } as any;
    const source = new MockSearchSource();
    service.register(source, plugin);
    await service.setActive("plugin1", "source1");
    const query: any = { entities: { tracks: true }, filters: [{ entityType: "track", attributeKey: "nonexistent", attributeType: "string" }] };
    await expect(service.search(query)).rejects.toThrow(BadRequestException);
  });
});
