import { PluginsService } from "./plugins.service";
import { Logger, NotFoundException, BadRequestException } from "@nestjs/common";
import { execFile } from "child_process";
import path from "path";
import { promisify } from "util";
import fs from "fs";
import * as fsPromises from "fs/promises";
import os from "os";
import { PluginUpdateStatus } from "./enum/plugin-update-status.enum";
import { DeregistrationBlockedError } from "../util/deregistration-blocked.error";
import Package from "../../package.json";
import { PORT } from "../config/constants";

jest.mock("mime", () => ({
  __esModule: true,
  default: {
    getType: jest.fn(),
    getExtension: jest.fn(),
  },
}));

jest.mock("music-metadata");

const defaultExecFileImpl = (cmd: any, args: any, options: any, cb: any) => {
  const callback = typeof options === "function" ? options : cb;
  callback(null, "", "");
};

jest.mock("child_process", () => ({
  execFile: jest.fn(),
}));

const execFileMock = execFile as jest.Mock;

const PLUGIN_ENTRY = `
module.exports = class DummyPlugin {
  async enable() { this.enabled = true; }
  async disable() {}
};
`;

async function createPluginDir(
  base: string,
  name: string,
  opts: { git?: boolean; entry?: string; packageJson?: any; skipEntry?: boolean } = {},
) {
  const dir = path.join(base, name);
  await fsPromises.mkdir(dir, { recursive: true });
  await fsPromises.writeFile(
    path.join(dir, "package.json"),
    JSON.stringify(opts.packageJson ?? { name, version: "1.0.0", main: "index.js" }),
  );
  if (!opts.skipEntry) {
    await fsPromises.writeFile(path.join(dir, "index.js"), opts.entry ?? PLUGIN_ENTRY);
  }
  if (opts.git) {
    await fsPromises.mkdir(path.join(dir, ".git"));
  }
  return dir;
}

async function writeFlatPlugin(dir: string, packageJson: any, entry = "module.exports = 1;") {
  await fsPromises.writeFile(
    path.join(dir, "package.json"),
    JSON.stringify(packageJson),
  );
  await fsPromises.writeFile(path.join(dir, "index.js"), entry);
}

function makeServiceMocks() {
  return {
    librariesService: {
      register: jest.fn(),
      unregister: jest.fn(),
      allFlat: jest.fn(() => []),
      findLibrary: jest.fn(() => null),
      forEachTrackId: jest.fn(async () => {}),
    },
    identifiersService: { register: jest.fn(), unregister: jest.fn() },
    tasksService: { registerSystemTask: jest.fn(), registerPluginTask: jest.fn() },
    languagesService: { registerLanguageDirectory: jest.fn() },
    attributeSourcesService: {
      registerAttributeSource: jest.fn(),
      unregisterAttributeSource: jest.fn(),
    },
    artistManagerService: {
      registerIdentifier: jest.fn(),
      unregisterIdentifier: jest.fn(),
      forEachArtistId: jest.fn(async () => {}),
      count: jest.fn(async () => 2),
      findMany: jest.fn(async () => []),
      findManyRaw: jest.fn(async () => []),
      findOne: jest.fn(async () => null),
    },
    iconsService: { registerIconDirectory: jest.fn() },
    externalUrlsService: { registerSource: jest.fn(), unregisterSource: jest.fn() },
    albumManagerService: {
      registerIdentifier: jest.fn(),
      unregisterIdentifier: jest.fn(),
      forEachAlbumId: jest.fn(async () => {}),
      count: jest.fn(async () => 3),
      findMany: jest.fn(async () => []),
      findManyRaw: jest.fn(async () => []),
      findOne: jest.fn(async () => null),
    },
    pluginConfigService: { registerConfigManager: jest.fn(), registerUserConfigManager: jest.fn() },
    ephemeralService: {
      registerEphemeralSource: jest.fn(),
      unregisterEphemeralSource: jest.fn(),
      getSourcesUsingHandler: jest.fn(() => []),
      removeIdentifierClaims: jest.fn(),
      removeAttributeSource: jest.fn(),
    },
    trackManagerService: {
      count: jest.fn(async () => 4),
      findOne: jest.fn(async () => null),
      find: jest.fn(async () => []),
    },
    audioSessionsService: {
      createSession: jest.fn(async () => ({ id: "sess-id", type: "preview", getProducer: jest.fn() })),
    },
    userManagerService: {
      usernameToUuid: jest.fn(async () => "user-uuid"),
      findOne: jest.fn(async () => null),
      generateJwt: jest.fn(async () => "jwt-token"),
      parseJwt: jest.fn(async () => ({ sub: "user-uuid" })),
      count: jest.fn(async () => 7),
      forEachUserId: jest.fn(async () => {}),
    },
    playlistsService: { createPlaylistClient: jest.fn(() => ({ marker: "playlists" })) },
    workflowsService: { createClient: jest.fn(() => ({ marker: "workflows" })) },
    SearchSourcesService: {
      register: jest.fn(),
      getAllSources: jest.fn(() => ["src1"]),
      getSource: jest.fn(() => ({ id: "src1" })),
      getLoaded: jest.fn(() => null),
    },
    playbackHistoryService: { createClient: jest.fn(() => ({ marker: "playback" })) },
    dataSource: {
      getRepository: jest.fn(() => ({
        find: jest.fn(async () => []),
      })),
    },
    savedAlbumsService: {
      saveAlbum: jest.fn(async () => {}),
      unsaveAlbum: jest.fn(async () => {}),
      saveEphemeralAlbum: jest.fn(async () => "session-uuid"),
    },
    savedArtistsService: {
      saveArtist: jest.fn(async () => {}),
      unsaveArtist: jest.fn(async () => {}),
      saveEphemeralArtist: jest.fn(async () => {}),
    },
    savedTracksService: {
      saveTrack: jest.fn(async () => {}),
      unsaveTrack: jest.fn(async () => {}),
      saveEphemeralTrack: jest.fn(async () => "session-uuid"),
    },
  };
}

describe("PluginsService", () => {
  let service: PluginsService;
  let pluginsMap: Map<string, any>;
  let mocks: ReturnType<typeof makeServiceMocks>;
  let tmpBase: string;
  let pluginsDirectory: string;

  const loadedPlugin = (
    name: string,
    overrides: { updateStatus?: PluginUpdateStatus; directoryPath?: string; plugin?: any } = {},
  ) => ({
    plugin: overrides.plugin ?? { enable: jest.fn(), disable: jest.fn() },
    package: { name, version: "1.0.0" },
    directoryPath: overrides.directoryPath ?? `/plugins/${name}`,
    updateStatus: overrides.updateStatus ?? PluginUpdateStatus.NOT_CHECKED,
  });

  beforeEach(async () => {
    jest.restoreAllMocks();
    execFileMock.mockImplementation(defaultExecFileImpl);
    (execFileMock as any)[promisify.custom] = (cmd: any, args: any, options?: any) =>
      new Promise((resolve, reject) => {
        execFileMock(cmd, args, options, (err: any, stdout: any, stderr: any) =>
          err ? reject(err) : resolve({ stdout, stderr }),
        );
      });
    tmpBase = await fsPromises.mkdtemp(path.join(os.tmpdir(), "plugins-spec-"));
    pluginsDirectory = path.join(tmpBase, "plugins");
    await fsPromises.mkdir(pluginsDirectory, { recursive: true });
    process.env.PLUGIN_DIRECTORY = pluginsDirectory;
    jest.spyOn(PluginsService.prototype, "scan").mockImplementation(async () => {});
    mocks = makeServiceMocks();
    service = new PluginsService(
      mocks.librariesService,
      mocks.identifiersService,
      mocks.tasksService,
      mocks.languagesService,
      mocks.attributeSourcesService,
      mocks.artistManagerService,
      mocks.iconsService,
      mocks.externalUrlsService,
      mocks.albumManagerService,
      mocks.pluginConfigService,
      mocks.ephemeralService,
      mocks.trackManagerService,
      mocks.audioSessionsService,
      mocks.userManagerService,
      mocks.playlistsService,
      mocks.workflowsService,
      mocks.SearchSourcesService,
      mocks.playbackHistoryService,
      mocks.dataSource,
      mocks.savedAlbumsService,
      mocks.savedArtistsService,
      mocks.savedTracksService,
    );
    pluginsMap = (service as any).plugins;
  });

  afterEach(async () => {
    delete process.env.PLUGIN_DIRECTORY;
    jest.restoreAllMocks();
    await fsPromises.rm(tmpBase, { recursive: true, force: true });
  });

  it("scans the plugins directory and loads valid plugins", async () => {
    await createPluginDir(pluginsDirectory, "goodplugin", { git: true });
    await createPluginDir(pluginsDirectory, "brokenplugin", { skipEntry: true });
    await fsPromises.mkdir(path.join(pluginsDirectory, ".hidden"));
    await fsPromises.writeFile(path.join(pluginsDirectory, "stray-file"), "x");
    jest.restoreAllMocks();
    await (service as any).scan();
    expect(pluginsMap.has("goodplugin")).toBe(true);
    expect(pluginsMap.get("goodplugin").updateStatus).toBe(PluginUpdateStatus.NOT_CHECKED);
    expect(pluginsMap.has("brokenplugin")).toBe(false);
    expect(pluginsMap.has(".hidden")).toBe(false);
  });

  it("scan returns early when already scanning", async () => {
    jest.restoreAllMocks();
    const readdirSpy = jest
      .spyOn(jest.requireActual("fs/promises") as any, "readdir")
      .mockResolvedValue([]);
    (service as any).isScanning = true;
    await (service as any).scan();
    expect(readdirSpy).not.toHaveBeenCalled();
  });

  it("scan creates the directory when it does not exist", async () => {
    jest.restoreAllMocks();
    const actual = jest.requireActual("fs/promises") as any;
    const missingDir = path.join(tmpBase, "does-not-exist");
    (service as any).pluginsDirectory = missingDir;
    const mkdirSpy = jest.spyOn(actual, "mkdir").mockResolvedValue(undefined);
    jest.spyOn(actual, "lstat").mockResolvedValue({ isDirectory: () => true } as any);
    jest.spyOn(actual, "readdir").mockResolvedValue([]);
    await (service as any).scan();
    expect(mkdirSpy).toHaveBeenCalledWith(missingDir, { recursive: true });
  });

  it("scan exits fatally when the plugin path is not a directory", async () => {
    jest.restoreAllMocks();
    const exitSpy = jest
      .spyOn(process, "exit")
      .mockImplementation(((code?: number) => {
        throw new Error("process.exit");
      }) as any);
    (service as any).pluginsDirectory = path.join(tmpBase, "a-file");
    await fsPromises.writeFile(path.join(tmpBase, "a-file"), "x");
    await expect((service as any).scan()).rejects.toThrow("process.exit");
    expect(exitSpy).toHaveBeenCalledWith(1);
  });

  it("registers a check-plugin-updates system task", () => {
    expect(mocks.tasksService.registerSystemTask).toHaveBeenCalledWith(
      expect.objectContaining({ id: "check-plugin-updates", resumable: false }),
    );
  });

  it("check-plugin-updates task checks each updatable plugin and reports progress", async () => {
    const task = mocks.tasksService.registerSystemTask.mock.calls[0][0];
    pluginsMap.set("has-update", loadedPlugin("has-update", { directoryPath: "/p1" }));
    pluginsMap.set("up-to-date", loadedPlugin("up-to-date", { directoryPath: "/p2" }));
    pluginsMap.set("unsupported", loadedPlugin("unsupported", { updateStatus: PluginUpdateStatus.UNSUPPORTED }));
    pluginsMap.set("failing", loadedPlugin("failing", { directoryPath: "/pfail" }));

    execFileMock.mockImplementation((cmd: any, args: any, options: any, cb: any) => {
      const callback = typeof options === "function" ? options : cb;
      if (args.includes("fetch") && options?.cwd === "/pfail") {
        return callback(new Error("network down"), "", "");
      }
      if (args.includes("rev-list")) {
        return callback(null, options.cwd === "/p1" ? "3\n" : "0\n", "");
      }
      return callback(null, "", "");
    });

    const update = jest.fn();
    await task.run({ update });

    expect(update).toHaveBeenNthCalledWith(1, 1 / 3);
    expect(update).toHaveBeenNthCalledWith(2, 2 / 3);
    expect(update).toHaveBeenNthCalledWith(3, 1);
    expect(pluginsMap.get("has-update").updateStatus).toBe(PluginUpdateStatus.HAS_UPDATE);
    expect(pluginsMap.get("up-to-date").updateStatus).toBe(PluginUpdateStatus.UP_TO_DATE);
  });

  describe("plugin API context", () => {
    let context: any;
    let dummyPlugin: any;

    beforeEach(() => {
      dummyPlugin = { enable: jest.fn(), disable: jest.fn() } as any;
      pluginsMap.set("dummy", {
        plugin: dummyPlugin,
        package: { name: "dummy", version: "1.0.0" },
        directoryPath: "/plugins/dummy",
        updateStatus: null,
      });
      context = (service as any).createPluginApiContext(
        pluginsMap.get("dummy"),
        "/plugins/dummy",
      );
    });

    it("provides basic server info", () => {
      expect(context.getServerVersion()).toBe(Package.version);
      expect(context.getServerPort()).toBe(PORT);
      expect(context.getPluginPackage()).toEqual({ name: "dummy", version: "1.0.0" });
      expect(context.getLogger()).toBeInstanceOf(Logger);
    });

    it("getPlugin resolves the plugin or null", async () => {
      await expect(context.getPlugin("dummy")).resolves.toBe(dummyPlugin);
      await expect(context.getPlugin("unknown")).resolves.toBeNull();
    });

    it("getPlugin waits for scanning to finish", async () => {
      (service as any).isScanning = true;
      const pending = context.getPlugin("dummy");
      (service as any).isScanning = false;
      for (const listener of (service as any).waitListeners) {
        listener();
      }
      (service as any).waitListeners.clear();
      await expect(pending).resolves.toBe(dummyPlugin);
    });

    it("requestCacheDirectory creates and returns the cache directory", async () => {
      const dir = path.join("plugin-cache", "dummy");
      const existedBefore = fs.existsSync(dir);
      expect(await context.requestCacheDirectory()).toBe(dir);
      expect(fs.existsSync(dir)).toBe(true);
      if (!existedBefore) {
        await fsPromises.rm(dir, { recursive: true, force: true });
      }
    });

    it("requestTempDirectory returns a fresh temp directory", async () => {
      const dir = await context.requestTempDirectory();
      expect(dir).toMatch(/temp\/[^/]+/);
      expect(fs.existsSync(dir)).toBe(true);
      await fsPromises.rm(dir, { recursive: true, force: true });
    });

    it("delegates all register* methods to their services", () => {
      const handler = { id: "handler" } as any;
      const identifier = { id: "ident" } as any;
      const source = { id: "source" } as any;
      const configManager = { id: "config" } as any;
      const task = { id: "task" } as any;
      const plugin = pluginsMap.get("dummy");

      context.registerLibraryHandler(handler);
      context.registerTrackIdentifier(identifier);
      context.registerArtistIdentifier(identifier);
      context.registerAlbumIdentifier(identifier);
      context.registerTask(task);
      context.registerLanguageDirectory("lang");
      context.registerAttributeSource(source);
      context.registerIconDirectory("icons");
      context.registerExternalUrlSource(source);
      context.registerConfigManager(configManager);
      context.registerUserConfigManager("usercfg", configManager);
      context.registerEphemeralSource(source);
      context.registerSearchSource(source);

      expect(mocks.librariesService.register).toHaveBeenCalledWith(handler, plugin);
      expect(mocks.identifiersService.register).toHaveBeenCalledWith(identifier, plugin);
      expect(mocks.artistManagerService.registerIdentifier).toHaveBeenCalledWith(identifier, plugin);
      expect(mocks.albumManagerService.registerIdentifier).toHaveBeenCalledWith(identifier, plugin);
      expect(mocks.tasksService.registerPluginTask).toHaveBeenCalledWith(task, plugin);
      expect(mocks.languagesService.registerLanguageDirectory).toHaveBeenCalledWith(
        path.join("/plugins/dummy", "lang"),
        plugin,
      );
      expect(mocks.attributeSourcesService.registerAttributeSource).toHaveBeenCalledWith(plugin, source);
      expect(mocks.iconsService.registerIconDirectory).toHaveBeenCalledWith(
        path.join("/plugins/dummy", "icons"),
        plugin,
      );
      expect(mocks.externalUrlsService.registerSource).toHaveBeenCalledWith(source, plugin);
      expect(mocks.pluginConfigService.registerConfigManager).toHaveBeenCalledWith(configManager, plugin);
      expect(mocks.pluginConfigService.registerUserConfigManager).toHaveBeenCalledWith("usercfg", configManager, plugin);
      expect(mocks.ephemeralService.registerEphemeralSource).toHaveBeenCalledWith(source, plugin);
      expect(mocks.SearchSourcesService.register).toHaveBeenCalledWith(source, plugin);
    });

    it("delegates all unregister* methods to their services", () => {
      const handler = { id: "handler" } as any;
      const identifier = { id: "ident" } as any;
      const source = { id: "source" } as any;
      const plugin = pluginsMap.get("dummy");

      context.unregisterLibraryHandler(handler);
      context.unregisterTrackIdentifier(identifier);
      context.unregisterArtistIdentifier(identifier);
      context.unregisterAlbumIdentifier(identifier);
      context.unregisterAttributeSource(source);
      context.unregisterEphemeralSource(source);
      context.unregisterExternalUrlSource(source);

      expect(mocks.librariesService.unregister).toHaveBeenCalledWith(handler, plugin);
      expect(mocks.identifiersService.unregister).toHaveBeenCalledWith(identifier, plugin);
      expect(mocks.ephemeralService.removeIdentifierClaims).toHaveBeenCalledWith("dummy", "ident");
      expect(mocks.artistManagerService.unregisterIdentifier).toHaveBeenCalledWith(identifier, plugin);
      expect(mocks.albumManagerService.unregisterIdentifier).toHaveBeenCalledWith(identifier, plugin);
      expect(mocks.attributeSourcesService.unregisterAttributeSource).toHaveBeenCalledWith(plugin, source);
      expect(mocks.ephemeralService.removeAttributeSource).toHaveBeenCalledWith(source);
      expect(mocks.ephemeralService.unregisterEphemeralSource).toHaveBeenCalledWith(source, plugin);
      expect(mocks.externalUrlsService.unregisterSource).toHaveBeenCalledWith(source, plugin);
    });

    it("unregisterLibraryHandler throws when blocked by ephemeral sources", () => {
      const handler = { id: "handler" } as any;
      mocks.ephemeralService.getSourcesUsingHandler.mockReturnValue([{ id: "using" }]);
      expect(() => context.unregisterLibraryHandler(handler)).toThrow(DeregistrationBlockedError);
      expect(mocks.librariesService.unregister).not.toHaveBeenCalled();
    });

    it("auth client resolves users and tokens", async () => {
      const auth = context.requestAuthClient();
      await expect(auth.getUuid("alice")).resolves.toBe("user-uuid");
      mocks.userManagerService.findOne.mockResolvedValueOnce({ username: "alice" });
      await expect(auth.getUsername("user-uuid")).resolves.toBe("alice");
      mocks.userManagerService.findOne.mockResolvedValueOnce(null);
      await expect(auth.getUsername("user-uuid")).resolves.toBeNull();
      mocks.userManagerService.findOne.mockResolvedValueOnce({ username: "alice" });
      await expect(auth.generateUserToken("user-uuid")).resolves.toBe("jwt-token");
      expect(mocks.userManagerService.generateJwt).toHaveBeenCalledWith(
        { username: "alice" },
        "dummy",
      );
      mocks.userManagerService.findOne.mockResolvedValueOnce(null);
      await expect(auth.generateUserToken("missing")).rejects.toThrow("User not found");
      await expect(auth.getUserFromToken("jwt-token")).resolves.toBe("user-uuid");
    });

    it("client getters delegate to services", () => {
      expect(context.getPlaylistClient()).toEqual({ marker: "playlists" });
      expect(context.getWorkflowClient()).toEqual({ marker: "workflows" });
      expect(context.getPlaybackHistoryClient()).toEqual({ marker: "playback" });
      expect(context.getSearchSources()).toEqual(["src1"]);
      expect(context.getSearchSource("dummy", "src1")).toEqual({ id: "src1" });
      expect(context.getActiveSearchSource()).toBeNull();
      mocks.SearchSourcesService.getLoaded.mockReturnValueOnce({ source: { id: "active" } });
      expect(context.getActiveSearchSource()).toEqual({ id: "active" });
    });
  });

  describe("data client", () => {
    let data: any;

    beforeEach(() => {
      pluginsMap.set("pluginA", loadedPlugin("pluginA"));
      pluginsMap.set("pluginB", loadedPlugin("pluginB"));
      data = (service as any).createDataClient();
    });

    it("lists plugins and resolves ids", () => {
      const plugins = data.getPlugins();
      expect(Object.keys(plugins).sort()).toEqual(["pluginA", "pluginB"]);
      expect(data.getPlugin("pluginA")).toBe(pluginsMap.get("pluginA").plugin);
      expect(data.getPlugin("nope")).toBeNull();
      expect(data.getPluginId(pluginsMap.get("pluginB").plugin)).toBe("pluginB");
      expect(data.getPluginId({})).toBeNull();
    });

    it("getResource validates input and reads files", async () => {
      const uuid = "12345678-1234-4234-8234-123456789abc";
      await expect(data.getResource("not-a-uuid", "json")).rejects.toThrow("Invalid resource UUID");
      await expect(data.getResource(uuid, "a.b")).rejects.toThrow("Invalid resource extension");
      await expect(data.getResource(uuid, "json")).resolves.toBeNull();

      const fileDir = path.join("resources", uuid.substring(0, 3));
      const file = path.join(fileDir, `${uuid}.json`);
      const dirExistedBefore = fs.existsSync(fileDir);
      await fsPromises.mkdir(fileDir, { recursive: true });
      await fsPromises.writeFile(file, "payload");
      try {
        const content = await data.getResource(uuid, "json");
        expect(content.toString()).toBe("payload");
      } finally {
        await fsPromises.rm(file, { force: true });
        if (!dirExistedBefore) {
          await fsPromises.rm(fileDir, { recursive: true, force: true });
        }
      }
    });

    it("exposes library handlers", () => {
      const handler = { id: "lib-handler" } as any;
      const plugin = pluginsMap.get("pluginA");
      mocks.librariesService.allFlat.mockReturnValue([{ handler, plugin }]);
      expect(data.getLibraryHandlerIds()).toEqual([
        { pluginId: "pluginA", libraryId: "lib-handler" },
      ]);
      mocks.librariesService.findLibrary.mockReturnValueOnce({ handler });
      expect(data.getLibraryHandler("pluginA", "lib-handler")).toBe(handler);
      mocks.librariesService.findLibrary.mockReturnValueOnce(null);
      expect(data.getLibraryHandler("pluginA", "lib-handler")).toBeNull();
    });

    it("exposes user and count helpers", async () => {
      expect(await data.getUserCount()).toBe(7);
      expect(await data.getTrackCount("pluginA", "lib")).toBe(4);
      expect(await data.getAlbumCount()).toBe(3);
      expect(await data.getArtistCount()).toBe(2);
      const seen: string[] = [];
      await data.forEachUserId((id: string) => seen.push(id));
      expect(mocks.userManagerService.forEachUserId).toHaveBeenCalled();
      const albumCallback = jest.fn();
      data.forEachAlbumId(albumCallback);
      expect(mocks.albumManagerService.forEachAlbumId).toHaveBeenCalledWith(albumCallback);
      const artistCallback = jest.fn();
      data.forEachArtistId(artistCallback);
      expect(mocks.artistManagerService.forEachArtistId).toHaveBeenCalledWith(artistCallback);
      expect(seen).toEqual([]);
    });

    it("creates audio sessions", async () => {
      mocks.audioSessionsService.createSession.mockResolvedValueOnce({
        id: "sess-id",
        type: "preview",
        getProducer: jest.fn(() => "producer"),
      });
      const session = await data.createAudioSession("pluginA", "lib", "track", "preview");
      expect(session.getId()).toBe("sess-id");
      expect(session.getType()).toBe("preview");
      expect(session.getAudioProducer()).toBe("producer");
      expect(mocks.audioSessionsService.createSession).toHaveBeenCalledWith("pluginA", "lib", "track", "preview");
    });

    it("forEachTrackId requires an existing library", async () => {
      const callback = jest.fn();
      await expect(data.forEachTrackId("pluginA", "missing", callback)).rejects.toThrow(
        "Library does not exist",
      );
      const library = { handler: { id: "lib" } } as any;
      mocks.librariesService.findLibrary.mockReturnValueOnce(library);
      await data.forEachTrackId("pluginA", "lib", callback);
      expect(mocks.librariesService.forEachTrackId).toHaveBeenCalledWith(library, callback);
    });

    it("finds single entities", async () => {
      const track = { toSavedResponse: jest.fn(() => "track-response") } as any;
      mocks.trackManagerService.findOne.mockResolvedValueOnce(track);
      await expect(data.getTrack("pluginA", "lib", "trackId")).resolves.toBe("track-response");
      mocks.trackManagerService.findOne.mockResolvedValueOnce(null);
      await expect(data.getTrack("pluginA", "lib", "trackId")).resolves.toBeNull();

      const album = { toSavedResponse: jest.fn(() => "album-response") } as any;
      mocks.albumManagerService.findOne.mockResolvedValueOnce(album);
      await expect(data.getAlbum("album-uuid", { relations: { artists: true } })).resolves.toBe("album-response");
      mocks.albumManagerService.findOne.mockResolvedValueOnce(null);
      await expect(data.getAlbum("album-uuid")).resolves.toBeNull();

      const artist = { toSavedResponse: jest.fn(() => "artist-response") } as any;
      mocks.artistManagerService.findOne.mockResolvedValueOnce(artist);
      await expect(data.getArtist("artist-uuid", { relations: { albums: true } })).resolves.toBe("artist-response");
      mocks.artistManagerService.findOne.mockResolvedValueOnce(null);
      await expect(data.getArtist("artist-uuid")).resolves.toBeNull();
    });

    it("finds many entities", async () => {
      await expect(data.getTracks([])).resolves.toEqual([]);
      const tracks = [{ toSavedResponse: jest.fn(() => "t1") }] as any[];
      mocks.trackManagerService.find.mockResolvedValueOnce(tracks);
      await expect(
        data.getTracks([{ pluginId: "pluginA", libraryId: "lib", trackId: "t" }]),
      ).resolves.toEqual(["t1"]);

      await expect(data.getAlbums([])).resolves.toEqual([]);
      const albums = [{ toSavedResponse: jest.fn(() => "a1") }] as any[];
      mocks.albumManagerService.findManyRaw.mockResolvedValueOnce(albums);
      await expect(data.getAlbums(["album-uuid"])).resolves.toEqual(["a1"]);

      await expect(data.getArtists([])).resolves.toEqual([]);
      const artists = [{ toSavedResponse: jest.fn(() => "ar1") }] as any[];
      mocks.artistManagerService.findManyRaw.mockResolvedValueOnce(artists);
      await expect(data.getArtists(["artist-uuid"])).resolves.toEqual(["ar1"]);

      mocks.albumManagerService.findMany.mockResolvedValueOnce([{ uuid: "u1" }, { uuid: "u2" }]);
      await expect(data.getAlbumUuids(10, 0)).resolves.toEqual(["u1", "u2"]);
      mocks.artistManagerService.findMany.mockResolvedValueOnce([{ uuid: "au1" }]);
      await expect(data.getArtistUuids(5, 1)).resolves.toEqual(["au1"]);
    });
  });

  describe("buildPlugin", () => {
    it("installs dependencies and returns package.json when there is no build script", async () => {
      const tempDir = await fsPromises.mkdtemp(path.join(tmpBase, "build-"));
      await writeFlatPlugin(tempDir, { name: "bp", version: "1.0.0", main: "index.js" });
      const pkg = await (service as any).buildPlugin(tempDir);
      expect(pkg).toEqual({ name: "bp", version: "1.0.0", main: "index.js" });
      expect(execFileMock).toHaveBeenCalledWith(
        "npm",
        ["ci", "--include=dev"],
        expect.objectContaining({ cwd: tempDir }),
        expect.any(Function),
      );
    });

    it("runs build and prune scripts when present", async () => {
      const tempDir = await fsPromises.mkdtemp(path.join(tmpBase, "build2-"));
      await writeFlatPlugin(tempDir, {
        name: "bp2",
        version: "1.0.0",
        main: "index.js",
        scripts: { build: "node -e ''" },
      });
      await (service as any).buildPlugin(tempDir);
      expect(execFileMock).toHaveBeenCalledWith("npm", ["ci", "--include=dev"], expect.objectContaining({ cwd: tempDir }), expect.any(Function));
      expect(execFileMock).toHaveBeenCalledWith("npm", ["run", "build"], expect.objectContaining({ cwd: tempDir }), expect.any(Function));
      expect(execFileMock).toHaveBeenCalledWith("npm", ["prune", "--omit=dev"], expect.objectContaining({ cwd: tempDir }), expect.any(Function));
    });

    it("throws when the entrypoint is missing after build", async () => {
      const tempDir = await fsPromises.mkdtemp(path.join(tmpBase, "build3-"));
      await fsPromises.writeFile(
        path.join(tempDir, "package.json"),
        JSON.stringify({ name: "bp3", version: "1.0.0", main: "index.js" }),
      );
      await expect((service as any).buildPlugin(tempDir)).rejects.toThrow(/Entrypoint "index.js" does not exist after build/);
    });

    it("throws when package.json cannot be read", async () => {
      const tempDir = await fsPromises.mkdtemp(path.join(tmpBase, "build4-"));
      await expect((service as any).buildPlugin(tempDir)).rejects.toThrow('Failed to read "package.json"');
    });
  });

  describe("installPlugin", () => {
    const gitUrl = "https://github.com/user/repo.git";

    it("throws BadRequestException if plugin already installed", async () => {
      await createPluginDir(pluginsDirectory, "plugin");
      jest.spyOn(service as any, "requestTempDirectory").mockResolvedValue(path.join(tmpBase, "temp"));
      jest.spyOn(service as any, "buildPlugin").mockResolvedValue({ name: "plugin", version: "1.0.0" });
      await expect(service.installPlugin(gitUrl)).rejects.toThrow(BadRequestException);
    });

    it("throws BadRequestException if plugin name missing", async () => {
      jest.spyOn(service as any, "requestTempDirectory").mockResolvedValue(path.join(tmpBase, "temp"));
      jest.spyOn(service as any, "buildPlugin").mockResolvedValue({});
      await expect(service.installPlugin(gitUrl)).rejects.toThrow(BadRequestException);
    });

    it("clones with a branch ref when provided", async () => {
      jest.spyOn(service as any, "requestTempDirectory").mockResolvedValue(path.join(tmpBase, "temp"));
      jest.spyOn(service as any, "buildPlugin").mockResolvedValue({});
      await service.installPlugin(gitUrl, "myref").catch(() => {});
      expect(execFileMock).toHaveBeenCalledWith(
        "git",
        ["clone", "--depth", "1", "--branch", "myref", gitUrl, path.join(tmpBase, "temp")],
        undefined,
        expect.any(Function),
      );
    });

    it("installs and loads a plugin end to end", async () => {
      const tempDir = await fsPromises.mkdtemp(path.join(tmpBase, "install-"));
      await writeFlatPlugin(
        tempDir,
        { name: "newplugin", version: "1.0.0", main: "index.js" },
        PLUGIN_ENTRY,
      );
      jest.spyOn(service as any, "requestTempDirectory").mockResolvedValue(tempDir);
      const result = await service.installPlugin(gitUrl);
      expect(result).toBe("newplugin");
      expect(pluginsMap.has("newplugin")).toBe(true);
      expect(pluginsMap.get("newplugin").plugin.enabled).toBe(true);
      expect(fs.existsSync(path.join(pluginsDirectory, "newplugin", "package.json"))).toBe(true);
    });

    it("cleans up and rethrows when the build fails", async () => {
      const tempDir = await fsPromises.mkdtemp(path.join(tmpBase, "installfail-"));
      jest.spyOn(service as any, "requestTempDirectory").mockResolvedValue(tempDir);
      await expect(service.installPlugin(gitUrl)).rejects.toThrow('Failed to read "package.json"');
      expect(fs.existsSync(tempDir)).toBe(false);
    });

    it("wraps load failures in a BadRequestException", async () => {
      const tempDir = await fsPromises.mkdtemp(path.join(tmpBase, "badload-"));
      await writeFlatPlugin(
        tempDir,
        { name: "badload", version: "1.0.0", main: "index.js" },
        "module.exports = {};",
      );
      jest.spyOn(service as any, "requestTempDirectory").mockResolvedValue(tempDir);
      await expect(service.installPlugin(gitUrl)).rejects.toThrow(/Plugin installed but failed to load/);
    });
  });

  describe("updatePlugin", () => {
    const pluginName = "plugin";

    it("throws NotFoundException if plugin not found", async () => {
      await expect(service.updatePlugin(pluginName)).rejects.toThrow(NotFoundException);
    });

    it("throws BadRequestException if plugin update status unsupported", async () => {
      pluginsMap.set(pluginName, loadedPlugin(pluginName, { updateStatus: PluginUpdateStatus.UNSUPPORTED }));
      await expect(service.updatePlugin(pluginName)).rejects.toThrow(BadRequestException);
    });

    it("throws BadRequestException if plugin already updating", async () => {
      pluginsMap.set(pluginName, loadedPlugin(pluginName, { updateStatus: PluginUpdateStatus.UPDATING }));
      await expect(service.updatePlugin(pluginName)).rejects.toThrow(BadRequestException);
    });

    it("updates the plugin directory end to end", async () => {
      await createPluginDir(pluginsDirectory, pluginName, { git: true });
      pluginsMap.set(pluginName, loadedPlugin(pluginName, { directoryPath: path.join(pluginsDirectory, pluginName) }));
      const tempDir = await fsPromises.mkdtemp(path.join(tmpBase, "update-"));
      jest.spyOn(service as any, "requestTempDirectory").mockResolvedValue(tempDir);

      await service.updatePlugin(pluginName);

      expect(pluginsMap.get(pluginName).updateStatus).toBe(PluginUpdateStatus.UP_TO_DATE);
      expect(execFileMock).toHaveBeenCalledWith("git", ["pull"], expect.objectContaining({ cwd: tempDir }), expect.any(Function));
      expect(fs.existsSync(path.join(pluginsDirectory, pluginName, "package.json"))).toBe(true);
    });

    it("restores the previous status when the update fails", async () => {
      await createPluginDir(pluginsDirectory, pluginName, { git: true });
      pluginsMap.set(pluginName, loadedPlugin(pluginName, { directoryPath: path.join(pluginsDirectory, pluginName) }));
      const tempDir = await fsPromises.mkdtemp(path.join(tmpBase, "updatefail-"));
      jest.spyOn(service as any, "requestTempDirectory").mockResolvedValue(tempDir);
      execFileMock.mockImplementation((cmd: any, args: any, options: any, cb: any) => {
        const callback = typeof options === "function" ? options : cb;
        if (args.includes("pull")) {
          return callback(new Error("git pull failed"), "", "");
        }
        return callback(null, "", "");
      });

      await expect(service.updatePlugin(pluginName)).rejects.toThrow("git pull failed");
      expect(pluginsMap.get(pluginName).updateStatus).toBe(PluginUpdateStatus.NOT_CHECKED);
      expect(fs.existsSync(tempDir)).toBe(false);
    });
  });

  describe("checkPluginForUpdates", () => {
    const pluginName = "plugin";

    it("throws NotFoundException if plugin not found", async () => {
      await expect(service.checkPluginForUpdates(pluginName)).rejects.toThrow(NotFoundException);
    });

    it("throws BadRequestException if plugin update status unsupported", async () => {
      pluginsMap.set(pluginName, loadedPlugin(pluginName, { updateStatus: PluginUpdateStatus.UNSUPPORTED }));
      await expect(service.checkPluginForUpdates(pluginName)).rejects.toThrow(BadRequestException);
    });

    it("reports available updates", async () => {
      pluginsMap.set(pluginName, loadedPlugin(pluginName));
      execFileMock.mockImplementation((cmd: any, args: any, options: any, cb: any) => {
        const callback = typeof options === "function" ? options : cb;
        if (args.includes("rev-list")) {
          return callback(null, "5\n", "");
        }
        return callback(null, "", "");
      });

      const result = await service.checkPluginForUpdates(pluginName);
      expect(result).toEqual({ updatesAvailable: true, commitsBehind: 5 });
      expect(pluginsMap.get(pluginName).updateStatus).toBe(PluginUpdateStatus.HAS_UPDATE);
      expect(execFileMock).toHaveBeenCalledWith("git", ["fetch", "origin"], expect.objectContaining({ cwd: `/plugins/${pluginName}` }), expect.any(Function));
    });

    it("reports up-to-date plugins", async () => {
      pluginsMap.set(pluginName, loadedPlugin(pluginName));
      execFileMock.mockImplementation((cmd: any, args: any, options: any, cb: any) => {
        const callback = typeof options === "function" ? options : cb;
        if (args.includes("rev-list")) {
          return callback(null, "0\n", "");
        }
        return callback(null, "", "");
      });

      const result = await service.checkPluginForUpdates(pluginName);
      expect(result).toEqual({ updatesAvailable: false, commitsBehind: 0 });
      expect(pluginsMap.get(pluginName).updateStatus).toBe(PluginUpdateStatus.UP_TO_DATE);
    });

    it("propagates git failures", async () => {
      pluginsMap.set(pluginName, loadedPlugin(pluginName));
      execFileMock.mockImplementation((cmd: any, args: any, options: any, cb: any) => {
        const callback = typeof options === "function" ? options : cb;
        return callback(new Error("git is down"), "", "");
      });
      await expect(service.checkPluginForUpdates(pluginName)).rejects.toThrow("git is down");
    });
  });

  describe("loadPluginFromDirectory", () => {
    it("loads a valid plugin with a git repo and enables it", async () => {
      const pluginDir = await createPluginDir(tmpBase, "gitplugin", { git: true });
      await (service as any).loadPluginFromDirectory(pluginDir);
      const loaded = pluginsMap.get("gitplugin");
      expect(loaded).toBeDefined();
      expect(loaded.updateStatus).toBe(PluginUpdateStatus.NOT_CHECKED);
      expect(loaded.plugin.enabled).toBe(true);
    });

    it("loads a valid plugin without a git repo as UNSUPPORTED", async () => {
      const pluginDir = await createPluginDir(tmpBase, "nogitplugin");
      await (service as any).loadPluginFromDirectory(pluginDir);
      expect(pluginsMap.get("nogitplugin").updateStatus).toBe(PluginUpdateStatus.UNSUPPORTED);
      expect(pluginsMap.get("nogitplugin").plugin.enabled).toBe(true);
    });

    it("rejects non-directory paths", async () => {
      const file = path.join(tmpBase, "a-file");
      await fsPromises.writeFile(file, "x");
      await expect((service as any).loadPluginFromDirectory(file)).rejects.toThrow("Plugin path is not a directory");
    });

    it("rejects directories without package.json", async () => {
      const dir = await fsPromises.mkdtemp(path.join(tmpBase, "nopkg-"));
      await expect((service as any).loadPluginFromDirectory(dir)).rejects.toThrow('Failed to read "package.json"');
    });

    it("rejects invalid package.json JSON", async () => {
      const dir = path.join(tmpBase, "badjson");
      await fsPromises.mkdir(dir);
      await fsPromises.writeFile(path.join(dir, "package.json"), "{not json");
      await expect((service as any).loadPluginFromDirectory(dir)).rejects.toThrow('"package.json" contains invalid JSON');
    });

    it("rejects package.json failing DTO validation", async () => {
      const dir = await createPluginDir(tmpBase, "invalidpkg", {
        packageJson: { name: "", version: "" },
        skipEntry: true,
      });
      await expect((service as any).loadPluginFromDirectory(dir)).rejects.toThrow('Failed to parse "package.json"');
    });

    it("rejects missing entrypoint files", async () => {
      const dir = await createPluginDir(tmpBase, "noentry", { skipEntry: true });
      await expect((service as any).loadPluginFromDirectory(dir)).rejects.toThrow(/Entrypoint file not found/);
    });

    it("rejects invalid entrypoints", async () => {
      const dir = await createPluginDir(tmpBase, "badentry", { entry: "module.exports = {};" });
      await expect((service as any).loadPluginFromDirectory(dir)).rejects.toThrow("Entrypoint is invalid");
    });

    it("rejects entrypoints that do not export a valid plugin", async () => {
      const dir = await createPluginDir(tmpBase, "notaplugin", {
        entry: "module.exports = class { async enable() {} };",
      });
      await expect((service as any).loadPluginFromDirectory(dir)).rejects.toThrow("Entrypoint doesn't export a valid plugin");
    });
  });

  describe("removePlugin", () => {
    it("removes the plugin directory and returns true", async () => {
      const destDir = await createPluginDir(pluginsDirectory, "myplugin");
      pluginsMap.set("myplugin", loadedPlugin("myplugin", { directoryPath: destDir }));
      const result = await service.removePlugin("myplugin");
      expect(result).toBe(true);
      expect(fs.existsSync(destDir)).toBe(false);
    });

    it("returns false for unknown plugins", async () => {
      await expect(service.removePlugin("unknown")).resolves.toBe(false);
    });
  });

  describe("getPlugin / all", () => {
    it("returns the plugin or null", () => {
      pluginsMap.set("myplugin", loadedPlugin("myplugin"));
      expect(service.getPlugin("myplugin")).toBe(pluginsMap.get("myplugin"));
      expect(service.getPlugin("unknown")).toBeNull();
    });

    it("returns all loaded plugins", () => {
      pluginsMap.set("a", loadedPlugin("a"));
      pluginsMap.set("b", loadedPlugin("b"));
      expect(service.all()).toHaveLength(2);
    });
  });
});
