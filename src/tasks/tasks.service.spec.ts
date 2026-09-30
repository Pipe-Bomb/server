import { TasksService } from "./tasks.service";
import { Repository } from "typeorm";
import { WorkflowsService } from "../workflows/workflows.service";
import { LoadedPlugin } from "../plugins/interface/loaded-plugin.interface";
import { DBResumableTaskProgress } from "./entity/resumable-task-progress.entity";
import { NotFoundException, ConflictException, BadRequestException } from "@nestjs/common";
import { TaskStatusResponse } from "./response/task.response";

class MockRepository implements Partial<Repository<DBResumableTaskProgress>> {
  countBy = jest.fn().mockResolvedValue(0);
  findBy = jest.fn().mockResolvedValue([]);
  insert = jest.fn().mockResolvedValue(undefined);
  update = jest.fn().mockResolvedValue(undefined);
  findOneBy = jest.fn().mockResolvedValue(undefined);
  findOne = jest.fn().mockResolvedValue(undefined);
  create = jest.fn((obj: any) => obj);
  delete = jest.fn().mockResolvedValue(undefined);
}

class MockWorkflowsService implements Partial<WorkflowsService> {
  registerStep = jest.fn();
}

let mockRepo: any;
let mockWorkflow: any;
let service: TasksService;

const plugin: LoadedPlugin = { package: { name: "plugin" } } as any;

describe("TasksService", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRepo = new MockRepository() as any;
    mockWorkflow = new MockWorkflowsService() as any;
    service = new TasksService(mockRepo, mockWorkflow);
  });

  it("registers a run-task workflow step", () => {
    expect(mockWorkflow.registerStep).toHaveBeenCalledTimes(1);
    const step = mockWorkflow.registerStep.mock.calls[0][0];
    expect(step.id).toBe("run-task");
    expect(step.type).toBe("step");
    const options = step.getOptions();
    expect(options).toHaveLength(1);
    expect(options[0]).toEqual({ type: "enum", id: "taskId", enum: [] });
  });

  it("builds task option enums from registered tasks", () => {
    const systemTask = { id: "sys", resumable: false, run: jest.fn() } as any;
    const subTask = {
      id: "subbed",
      resumable: false,
      getSubTasks: () => ["a", "b"],
      run: jest.fn(),
    } as any;
    const pluginSubTask = {
      id: "psub",
      resumable: false,
      getSubTasks: () => ["x"],
      run: jest.fn(),
    } as any;
    const pluginSimple = { id: "psimple", resumable: false, run: jest.fn() } as any;
    service.registerSystemTask(systemTask);
    service.registerSystemTask(subTask);
    service.registerPluginTask(pluginSubTask, plugin);
    service.registerPluginTask(pluginSimple, plugin);

    const step = mockWorkflow.registerStep.mock.calls[0][0];
    const enumValues = step.getOptions()[0].enum;
    expect(enumValues).toEqual([
      { id: ":sys:", languageKey: "task.system.sys.name" },
      { id: ":subbed:a", languageKey: "task.system.subbed.subtask.a.name" },
      { id: ":subbed:b", languageKey: "task.system.subbed.subtask.b.name" },
      { id: "plugin:psub:x", languageKey: "task.plugin.plugin.psub.subtask.x.name" },
      { id: "plugin:psimple:", languageKey: "task.plugin.plugin.psimple.name" },
    ]);
  });

  it("run-task workflow step runs a matching simple task", async () => {
    const runFn = jest.fn().mockResolvedValue(undefined);
    service.registerSystemTask({ id: "sys", resumable: false, run: runFn } as any);
    service.registerPluginTask({ id: "sys", resumable: false, run: jest.fn() } as any, plugin);

    const step = mockWorkflow.registerStep.mock.calls[0][0];
    const ctx = {
      getOption: jest.fn().mockReturnValue(":sys:"),
      updateProgress: jest.fn(),
    };
    await step.run(ctx);
    expect(runFn).toHaveBeenCalledTimes(1);
  });

  it("run-task workflow step runs a matching plugin task with subtask", async () => {
    const runFn = jest.fn().mockResolvedValue(undefined);
    service.registerPluginTask(
      {
        id: "ptask",
        resumable: false,
        getSubTasks: () => ["s1"],
        run: runFn,
      } as any,
      plugin,
    );

    const step = mockWorkflow.registerStep.mock.calls[0][0];
    const ctx = {
      getOption: jest.fn().mockReturnValue("plugin:ptask:s1"),
      updateProgress: jest.fn(),
    };
    await step.run(ctx);
    expect(runFn).toHaveBeenCalledWith(expect.anything(), "s1");
  });

  it("run-task workflow step reports progress", async () => {
    let resolveRun: () => void;
    const runFn = jest.fn(
      (ctx: any) =>
        new Promise<void>((resolve) => {
          resolveRun = () => {
            ctx.update(0.5);
            ctx.update(1);
            resolve();
          };
        }),
    );
    service.registerSystemTask({ id: "prog", resumable: false, run: runFn } as any);

    const step = mockWorkflow.registerStep.mock.calls[0][0];
    const updateProgress = jest.fn();
    const ctx = {
      getOption: jest.fn().mockReturnValue(":prog:"),
      updateProgress,
    };
    const stepRun = step.run(ctx);
    setTimeout(() => resolveRun!(), 10);
    await stepRun;
    expect(updateProgress).toHaveBeenCalledWith(0.5);
    expect(updateProgress).toHaveBeenCalledWith(1);
  });

  it("run-task workflow step throws for unspecified task", async () => {
    const step = mockWorkflow.registerStep.mock.calls[0][0];
    const ctx = { getOption: jest.fn().mockReturnValue(null), updateProgress: jest.fn() };
    await expect(step.run(ctx)).rejects.toThrow(/Unspecified task/);
  });

  it("run-task workflow step throws for malformed task ID", async () => {
    const step = mockWorkflow.registerStep.mock.calls[0][0];
    const ctx = { getOption: jest.fn().mockReturnValue(":"), updateProgress: jest.fn() };
    await expect(step.run(ctx)).rejects.toThrow(/Malformed task ID/);
  });

  it("run-task workflow step throws for invalid subtask", async () => {
    service.registerSystemTask({
      id: "subbed",
      resumable: false,
      getSubTasks: () => ["a"],
      run: jest.fn(),
    } as any);
    const step = mockWorkflow.registerStep.mock.calls[0][0];
    const ctx = {
      getOption: jest.fn().mockReturnValue(":subbed:wrong"),
      updateProgress: jest.fn(),
    };
    await expect(step.run(ctx)).rejects.toThrow(/Invalid or unspecified subtask ID/);
  });

  it("run-task workflow step throws for subtask on simple task", async () => {
    service.registerSystemTask({ id: "simple", resumable: false, run: jest.fn() } as any);
    const step = mockWorkflow.registerStep.mock.calls[0][0];
    const ctx = {
      getOption: jest.fn().mockReturnValue(":simple:sub"),
      updateProgress: jest.fn(),
    };
    await expect(step.run(ctx)).rejects.toThrow(/Subtask ID specified for simple task/);
  });

  it("registers system task", () => {
    const simpleTask = { id: "simple", resumable: false, run: jest.fn() } as any;
    service.registerSystemTask(simpleTask);
    const all = service.allTasks();
    expect(all).toHaveLength(1);
    expect(all[0].task.id).toBe("simple");
    expect(all[0].plugin).toBeNull();
  });

  it("throws error when registering duplicate system task", () => {
    const task = { id: "dup", resumable: false, run: jest.fn() } as any;
    service.registerSystemTask(task);
    expect(() => service.registerSystemTask(task)).toThrow(/System has already registered task/);
  });

  it("registers plugin task and prevents duplicates", () => {
    const pluginTask = { id: "pluginTask", resumable: false, run: jest.fn() } as any;
    service.registerPluginTask(pluginTask, plugin);
    expect(() => service.registerPluginTask(pluginTask, plugin)).toThrow(
      /Plugin "plugin" has already registered task/,
    );
    const all = service.allTasks();
    expect(all.find((t) => t.task.id === "pluginTask" && t.plugin?.package.name === "plugin")).toBeDefined();
  });

  it("allows same task id for different plugins", () => {
    const plugin2: LoadedPlugin = { package: { name: "plugin2" } } as any;
    const task = { id: "dup", resumable: false, run: jest.fn() } as any;
    service.registerPluginTask(task, plugin);
    service.registerPluginTask(task, plugin2);
    const all = service.allTasks();
    expect(all.filter((t) => t.task.id === "dup")).toHaveLength(2);
  });

  it("returns all plugin tasks correctly", () => {
    service.registerSystemTask({ id: "system", resumable: false, run: jest.fn() } as any);
    service.registerPluginTask({ id: "plugin", resumable: false, run: jest.fn() } as any, plugin);
    const pluginTasks = service.allPluginTasks();
    expect(pluginTasks).toHaveLength(1);
    expect(pluginTasks[0].plugin?.package.name).toBe("plugin");
  });

  it("returns all system tasks correctly", () => {
    service.registerSystemTask({ id: "system", resumable: false, run: jest.fn() } as any);
    service.registerPluginTask({ id: "plugin", resumable: false, run: jest.fn() } as any, plugin);
    const systemTasks = service.allSystemTasks();
    expect(systemTasks).toHaveLength(1);
    expect(systemTasks[0].plugin).toBeNull();
  });

  it("returns resumable progresses correctly", async () => {
    service.registerSystemTask({ id: "resumable", resumable: true, run: jest.fn() } as any);
    service.registerPluginTask({ id: "resumablePlugin", resumable: true, run: jest.fn() } as any, plugin);
    service.registerSystemTask({ id: "notResumable", resumable: false, run: jest.fn() } as any);
    const mockProgressArray = [
      { pluginId: "", taskId: "resumable", runId: "run1", subTaskId: null, progress: 0.5 },
      { pluginId: "plugin", taskId: "resumablePlugin", runId: "run2", subTaskId: null, progress: 0.75 },
    ];
    mockRepo.findBy.mockResolvedValueOnce(mockProgressArray);
    const progresses = await service.allResumableProgresses();
    expect(progresses).toEqual(mockProgressArray);
    expect(mockRepo.findBy).toHaveBeenCalledWith([
      { pluginId: "", taskId: "resumable" },
      { pluginId: "plugin", taskId: "resumablePlugin" },
    ]);
  });

  it("findTask finds tasks by plugin and id", () => {
    service.registerSystemTask({ id: "system", resumable: false, run: jest.fn() } as any);
    service.registerPluginTask({ id: "plugin", resumable: false, run: jest.fn() } as any, plugin);
    expect(service.findTask(null, "system")?.task.id).toBe("system");
    expect(service.findTask(plugin, "plugin")?.task.id).toBe("plugin");
    expect(service.findTask(null, "plugin")).toBeNull();
    expect(service.findTask(plugin, "system")).toBeNull();
    expect(service.findTask(null, "nope")).toBeNull();
  });

  it("toResponse returns RUNNING with percent for active task", () => {
    const task = { id: "t", resumable: false, run: jest.fn() } as any;
    const uuid = "uuid1";
    const loadedTask: any = { uuid, task, plugin: null };
    const activeTask: any = {
      ...loadedTask,
      percent: 0.5,
      runId: "run1",
      endCallbacks: new Set(),
      progressCallbacks: new Set(),
    };
    (service as any).activePluginTasks.push(activeTask);
    const response = service.toResponse(loadedTask, null);
    expect(response.status).toBe(TaskStatusResponse.RUNNING);
    expect(response.percent).toBeCloseTo(50);
    expect(response.subTasks).toBeNull();
    expect(response.resumable).toBe(false);
  });

  it("toResponse returns SUSPENDED with percent for resumable progress", () => {
    const task = {
      id: "t",
      resumable: true,
      getSubTasks: () => ["a", "b"],
      run: jest.fn(),
    } as any;
    const loadedTask: any = { uuid: "uuid2", task, plugin: null };
    const resumableProgress = {
      pluginId: "",
      taskId: "t",
      runId: "run2",
      subTaskId: null,
      progress: 0.75,
    };
    const response = service.toResponse(loadedTask, resumableProgress as any);
    expect(response.status).toBe(TaskStatusResponse.SUSPENDED);
    expect(response.percent).toBeCloseTo(75);
    expect(response.subTasks).toEqual(["a", "b"]);
  });

  it("toResponse returns null percent when progress is negative", () => {
    const task = { id: "t", resumable: true, run: jest.fn() } as any;
    const loadedTask: any = { uuid: "uuid3", task, plugin: null };
    const resumableProgress = {
      pluginId: "",
      taskId: "t",
      runId: "run2",
      subTaskId: null,
      progress: -1,
    };
    const response = service.toResponse(loadedTask, resumableProgress as any);
    expect(response.percent).toBeNull();
  });

  it("toResponse returns STOPPED when neither active nor resumable", () => {
    const task = {
      id: "t",
      resumable: true,
      getSubTasks: () => [],
      run: jest.fn(),
    } as any;
    const loadedTask: any = { uuid: "uuid4", task, plugin: null };
    const response = service.toResponse(loadedTask, null);
    expect(response.status).toBe(TaskStatusResponse.STOPPED);
    expect(response.percent).toBeNull();
    expect(response.subTasks).toBeNull();
  });

  it("runTask throws NotFoundException for unknown task", async () => {
    await expect(service.runTask("unknown-uuid", null)).rejects.toThrow(NotFoundException);
  });

  it("runTask throws ConflictException when task already running", async () => {
    let resolveRun: () => void;
    const runFn = jest.fn(
      () =>
        new Promise<void>((resolve) => {
          resolveRun = resolve;
        }),
    );
    service.registerSystemTask({ id: "conflict", resumable: false, run: runFn } as any);
    const uuid = service.allTasks()[0].uuid;
    await service.runTask(uuid, null);
    await expect(service.runTask(uuid, null)).rejects.toThrow(ConflictException);
    resolveRun!();
    await service.waitForTask(uuid);
  });

  it("runTask throws BadRequestException for simple task with subTask specified", async () => {
    service.registerSystemTask({ id: "simple", resumable: false, run: jest.fn() } as any);
    const uuid = service.allTasks()[0].uuid;
    await expect(service.runTask(uuid, "sub")).rejects.toThrow(BadRequestException);
  });

  it("runTask throws BadRequestException for resumable task without getSubTasks and subTask", async () => {
    service.registerSystemTask({ id: "resumableSimple", resumable: true, run: jest.fn() } as any);
    const uuid = service.allTasks()[0].uuid;
    await expect(service.runTask(uuid, "sub")).rejects.toThrow(BadRequestException);
  });

  it("runTask throws NotFoundException for resumable task with unknown subTask", async () => {
    service.registerSystemTask({
      id: "resumable",
      resumable: true,
      getSubTasks: () => ["sub1", "sub2"],
      run: jest.fn(),
    } as any);
    const uuid = service.allTasks()[0].uuid;
    await expect(service.runTask(uuid, "unknown")).rejects.toThrow(NotFoundException);
  });

  it("runTask stores resumable progress and cleans up after completion", async () => {
    const runFn = jest.fn().mockImplementation(async (ctx) => {
      ctx.update(0.5);
      ctx.update(1);
    });
    service.registerSystemTask({
      id: "resumable",
      resumable: true,
      getSubTasks: () => ["sub1", "sub2"],
      run: runFn,
    } as any);
    const uuid = service.allTasks()[0].uuid;
    mockRepo.findOneBy.mockResolvedValue(undefined);
    await service.runTask(uuid, "sub1");
    await service.waitForTask(uuid);
    expect(mockRepo.create).toHaveBeenCalled();
    const created = mockRepo.create.mock.calls[0][0];
    expect(created.pluginId).toBe("");
    expect(created.taskId).toBe("resumable");
    expect(created.subTaskId).toBe("sub1");
    expect(created.progress).toBe(-1);
    expect(created.runId).toBeDefined();
    expect(mockRepo.insert).toHaveBeenCalledWith(created);
    expect(mockRepo.update).toHaveBeenCalled();
    expect(mockRepo.delete).toHaveBeenCalledWith({ runId: created.runId });
  });

  it("runTask resumes existing resumable progress", async () => {
    const runFn = jest.fn().mockImplementation(async (ctx) => {
      ctx.update(1);
    });
    service.registerPluginTask(
      {
        id: "resumable",
        resumable: true,
        getSubTasks: () => ["sub1", "sub2"],
        run: runFn,
      } as any,
      plugin,
    );
    const uuid = service.allTasks()[0].uuid;
    const existingProgress = {
      pluginId: "plugin",
      taskId: "resumable",
      runId: "existingRun",
      subTaskId: "sub1",
      progress: 0.5,
    };
    mockRepo.findOneBy.mockResolvedValue(existingProgress);
    await service.runTask(uuid, "ignored-subtask");
    await service.waitForTask(uuid);
    expect(mockRepo.create).not.toHaveBeenCalled();
    expect(mockRepo.insert).not.toHaveBeenCalled();
    expect(runFn).toHaveBeenCalledWith(expect.anything(), "sub1");
    expect(mockRepo.delete).toHaveBeenCalledWith({ runId: "existingRun" });
  });

  it("runTask logs and continues when the task run fails", async () => {
    const runFn = jest.fn().mockRejectedValue(new Error("boom"));
    service.registerSystemTask({ id: "failing", resumable: false, run: runFn } as any);
    const uuid = service.allTasks()[0].uuid;
    await expect(service.runTask(uuid, null)).resolves.toBeUndefined();
    await service.waitForTask(uuid);
    expect(runFn).toHaveBeenCalled();
  });

  it("waitForTask resolves immediately when task not active", async () => {
    await expect(service.waitForTask("unknown-uuid")).resolves.toBeUndefined();
  });

  it("waitForTask resolves after task completes and reports progress", async () => {
    let resolveRun: () => void;
    const runFn = jest.fn(
      (ctx: any) =>
        new Promise<void>((resolve) => {
          resolveRun = () => {
            ctx.update(0.25);
            ctx.update(0.75);
            resolve();
          };
        }),
    );
    service.registerSystemTask({ id: "wait", resumable: false, run: runFn } as any);
    const uuid = service.allTasks()[0].uuid;
    await service.runTask(uuid, null);
    const percents: number[] = [];
    const waitP = service.waitForTask(uuid, (percent) => percents.push(percent));
    resolveRun!();
    await waitP;
    expect(runFn).toHaveBeenCalled();
    expect(percents).toEqual([0.25, 0.75]);
  });

  it("update clamps percent to [0, 1] and scales from starting progress", async () => {
    let resolveRun: () => void;
    service.registerSystemTask({
      id: "clamp",
      resumable: true,
      run: jest.fn(
        (ctx: any) =>
          new Promise<void>((resolve) => {
            resolveRun = () => {
              ctx.update(-5);
              ctx.update(10);
              resolve();
            };
          }),
      ),
    } as any);
    const uuid = service.allTasks()[0].uuid;
    const existingProgress = {
      pluginId: "",
      taskId: "clamp",
      runId: "runC",
      subTaskId: null,
      progress: 0.5,
    };
    mockRepo.findOneBy.mockResolvedValue(existingProgress);
    await service.runTask(uuid, null);
    const seen: number[] = [];
    const waitP = service.waitForTask(uuid, (p) => seen.push(p));
    resolveRun!();
    await waitP;
    expect(seen[0]).toBeCloseTo(0.5);
    expect(seen[1]).toBeCloseTo(1);
  });
});
