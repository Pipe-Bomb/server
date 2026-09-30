import { WorkflowsService } from "./workflows.service";
import {
  BadRequestException,
  ConflictException,
  Logger,
  NotFoundException,
} from "@nestjs/common";
import { DBWorkflow } from "./entity/workflow.entity";
import { DBWorkflowStep } from "./entity/workflow-step.entity";
import { DBWorkflowStepOptionValue } from "./entity/workflow-step-option-value.entity";
import { WorkflowStepType } from "./enum/workflow-step-type.enum";
import { CronJob, validateCronExpression } from "cron";

jest.mock("cron", () => ({
  __esModule: true,
  CronJob: jest.fn().mockImplementation(() => ({
    start: jest.fn(),
    stop: jest.fn(),
  })),
  validateCronExpression: jest.fn(() => ({ valid: true })),
}));

const CronJobMock = CronJob as unknown as jest.Mock;
const validateCron = validateCronExpression as jest.Mock;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const flush = () => new Promise((resolve) => setImmediate(resolve));

const makeOptionValue = (overrides: Partial<DBWorkflowStepOptionValue> = {}): any => ({
  stepUuid: "step-uuid",
  optionId: "opt",
  value_string: null,
  value_boolean: null,
  value_int: null,
  value_decimal: null,
  ...overrides,
});

const makeStep = (overrides: Partial<DBWorkflowStep> = {}): any => ({
  uuid: "step-uuid",
  workflowUuid: "wf-uuid",
  pluginId: null,
  stepId: "step-id",
  stepType: WorkflowStepType.STEP,
  previousStepUuid: null,
  optionValues: [],
  ...overrides,
});

const makeWorkflow = (overrides: Partial<DBWorkflow> = {}): any => ({
  uuid: "wf-uuid",
  name: "Workflow",
  ...overrides,
});

describe("WorkflowsService", () => {
  let service: WorkflowsService;
  let workflowsRepo: any;
  let stepsRepo: any;
  let optionValuesRepo: any;
  let entityManager: any;
  let dataSource: any;
  const plugin: any = { package: { name: "plugin" } };

  beforeEach(() => {
    workflowsRepo = {
      find: jest.fn().mockResolvedValue([]),
      findOne: jest.fn().mockResolvedValue(null),
      create: jest.fn((data: any) => ({ uuid: "wf-new", ...data })),
      save: jest.fn().mockImplementation(async (x: any) => x),
      delete: jest.fn().mockResolvedValue(undefined),
    };
    stepsRepo = {
      find: jest.fn().mockResolvedValue([]),
      findOne: jest.fn().mockResolvedValue(null),
      create: jest.fn((data: any) => ({ uuid: "step-new", ...data })),
      insert: jest.fn().mockResolvedValue(undefined),
    };
    optionValuesRepo = { findBy: jest.fn().mockResolvedValue([]) };
    entityManager = {
      findOne: jest.fn().mockResolvedValue(null),
      create: jest.fn((_cls: any, data: any) => ({ uuid: "em-new", ...data })),
      save: jest.fn().mockImplementation(async (_e: any, d?: any) => d),
      update: jest.fn().mockResolvedValue(undefined),
      delete: jest.fn().mockResolvedValue(undefined),
      insert: jest.fn().mockResolvedValue(undefined),
    };
    dataSource = {
      transaction: jest.fn(async (fn: any) => fn(entityManager)),
    };
    service = new WorkflowsService(
      workflowsRepo,
      stepsRepo,
      optionValuesRepo,
      dataSource,
    );
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe("onModuleInit", () => {
    it("populates workflow names and registers the four system definitions", async () => {
      workflowsRepo.find.mockResolvedValue([{ uuid: "w1", name: "W1" }]);
      await service.onModuleInit();

      const triggerIds = service
        .allTriggers()
        .map(({ object }) => object.id)
        .sort();
      expect(triggerIds).toEqual(["cron", "server-start", "workflow-end"]);
      const stepIds = service.allSteps().map(({ object }) => object.id);
      expect(stepIds).toEqual(["run-workflow"]);

      const runWorkflow = service.allSteps().find((s) => s.object.id === "run-workflow")!;
      const options = (runWorkflow.object as any).getOptions();
      expect(options[0]).toEqual({
        id: "workflow",
        type: "enum",
        enum: [{ id: "w1", name: "W1" }],
      });

      // one bootstrap query per trigger definition
      expect(stepsRepo.find).toHaveBeenCalledTimes(3);
      expect(stepsRepo.find).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            stepId: "server-start",
            stepType: WorkflowStepType.TRIGGER,
          }),
        }),
      );
    });
  });

  describe("system definitions", () => {
    beforeEach(async () => {
      await service.onModuleInit();
    });

    describe("server-start trigger", () => {
      const makeCtx = (reason: string) => {
        const activate = jest.fn();
        const ctx: any = {
          getCreateReason: () => reason,
          activate,
          getOption: () => null,
          getLogger: () => new Logger("test"),
        };
        return { ctx, activate };
      };

      it("activates the workflow 5s after a startup create", async () => {
        jest.useFakeTimers();
        const trigger = service.allTriggers().find((t) => t.object.id === "server-start")!;
        const { ctx, activate } = makeCtx("startup");
        (trigger.object as any).create(ctx);
        jest.advanceTimersByTime(5000);
        expect(activate).toHaveBeenCalledWith(false);
      });

      it("does nothing for non-startup creates", async () => {
        jest.useFakeTimers();
        const trigger = service.allTriggers().find((t) => t.object.id === "server-start")!;
        const { ctx, activate } = makeCtx("trigger-add");
        const destroy = (trigger.object as any).create(ctx);
        jest.advanceTimersByTime(10000);
        expect(activate).not.toHaveBeenCalled();
        expect(typeof destroy).toBe("function");
      });
    });

    describe("cron trigger", () => {
      const cron = () =>
        service.allTriggers().find((t) => t.object.id === "cron")!.object as any;

      it("does not schedule when no schedule option is set", () => {
        const logger = { warn: jest.fn(), error: jest.fn() };
        cron().create({
          getOption: () => null,
          getLogger: () => logger,
        });
        expect(logger.warn).toHaveBeenCalled();
        expect(CronJobMock).not.toHaveBeenCalled();
      });

      it("does not schedule when the cron expression is invalid", () => {
        validateCron.mockReturnValueOnce({ valid: false });
        cron().create({
          getOption: () => "not a cron",
          getLogger: () => ({ warn: jest.fn() }),
        });
        expect(CronJobMock).not.toHaveBeenCalled();
      });

      it("schedules a job and activates on tick; destroy stops it", () => {
        const activate = jest.fn();
        const destroy = cron().create({
          getOption: (id: string, type: string) =>
            id === "schedule" ? "*/5 * * * *" : id === "rerun" ? true : null,
          getLogger: () => new Logger("test"),
          activate,
        });
        expect(CronJobMock).toHaveBeenCalledWith("*/5 * * * *", expect.any(Function));
        const job = CronJobMock.mock.results[0].value;
        expect(job.start).toHaveBeenCalled();
        CronJobMock.mock.calls[0][1]();
        expect(activate).toHaveBeenCalledWith(true);
        destroy();
        expect(job.stop).toHaveBeenCalled();
      });
    });

    describe("run-workflow step", () => {
      const runWorkflow = () =>
        service.allSteps().find((s) => s.object.id === "run-workflow")!.object as any;

      it("throws when no workflow option is set", async () => {
        const ctx = {
          getOption: () => null,
          updateProgress: jest.fn(),
        };
        await expect(runWorkflow().run(ctx)).rejects.toThrow(
          "Workflow is not set or not loaded",
        );
      });

      it("activates the selected workflow", async () => {
        workflowsRepo.findOne.mockResolvedValue(makeWorkflow({ uuid: "w1", steps: [] }));
        const updateProgress = jest.fn();
        const ctx = {
          getOption: (id: string) => (id === "workflow" ? "w1" : null),
          updateProgress,
        };
        await runWorkflow().run(ctx);
        expect(workflowsRepo.findOne).toHaveBeenCalledWith(
          expect.objectContaining({ where: { uuid: "w1" } }),
        );
      });

      it("waits for the workflow to finish when requested", async () => {
        await service.registerStep(
          {
            id: "slow-step",
            type: "step",
            getOptions: () => [],
            run: async (ctx: any) => {
              await sleep(5);
              ctx.updateProgress(0.5);
            },
          },
          null,
        );
        workflowsRepo.findOne.mockResolvedValue(
          makeWorkflow({
            uuid: "w1",
            steps: [
              makeStep({
                uuid: "s1",
                stepId: "slow-step",
                workflowUuid: "w1",
                optionValues: [],
              }),
            ],
          }),
        );
        const progress: number[] = [];
        const ctx = {
          getOption: (id: string) =>
            id === "workflow" ? "w1" : id === "wait-for-finish" ? true : null,
          updateProgress: (p: number) => progress.push(p),
        };
        await runWorkflow().run(ctx);
        expect(progress).toEqual([0.5]);
      });
    });

    describe("workflow-end trigger", () => {
      const workflowEnd = () =>
        service.allTriggers().find((t) => t.object.id === "workflow-end")!.object as any;

      const makeCtx = (workflowId: string | null, endReason = "complete", rerun = true) => {
        const activate = jest.fn();
        const ctx: any = {
          getOption: (id: string) =>
            id === "workflow" ? workflowId : id === "end-reason" ? endReason : id === "rerun" ? rerun : null,
          getLogger: () => ({ error: jest.fn() }),
          activate,
        };
        return { ctx, activate };
      };

      it("does nothing when no workflow option is set", () => {
        const { ctx, activate } = makeCtx(null);
        const destroy = workflowEnd().create(ctx);
        expect(activate).not.toHaveBeenCalled();
        expect(typeof destroy).toBe("function");
      });

      it("activates when the watched workflow completes with a matching reason", async () => {
        let resolveStep: () => void;
        const deferred = new Promise<void>((r) => (resolveStep = r));
        await service.registerStep(
          {
            id: "slow-step",
            type: "step",
            getOptions: () => [],
            run: async () => {
              await deferred;
            },
          },
          null,
        );
        workflowsRepo.findOne.mockResolvedValue(
          makeWorkflow({
            uuid: "w1",
            steps: [
              makeStep({
                uuid: "s1",
                stepId: "slow-step",
                workflowUuid: "w1",
                optionValues: [],
              }),
            ],
          }),
        );

        service.activateWorkflow("w1", false);
        await flush();
        expect(service.getActive("w1")).not.toBeNull();

        const { ctx, activate } = makeCtx("w1", "complete", true);
        const destroy = workflowEnd().create(ctx);
        resolveStep!();
        await flush();

        expect(activate).toHaveBeenCalledWith(true);

        destroy();
        expect((service as any).workflowStartCallbacks.has("w1")).toBe(false);
      });

      it("does not activate when the end reason does not match", async () => {
        let resolveStep: () => void;
        const deferred = new Promise<void>((r) => (resolveStep = r));
        await service.registerStep(
          {
            id: "slow-step",
            type: "step",
            getOptions: () => [],
            run: async () => {
              await deferred;
            },
          },
          null,
        );
        workflowsRepo.findOne.mockResolvedValue(
          makeWorkflow({
            uuid: "w1",
            steps: [
              makeStep({
                uuid: "s1",
                stepId: "slow-step",
                workflowUuid: "w1",
                optionValues: [],
              }),
            ],
          }),
        );

        service.activateWorkflow("w1", false);
        await flush();

        const { ctx, activate } = makeCtx("w1", "error", false);
        workflowEnd().create(ctx);
        resolveStep!();
        await flush();

        expect(activate).not.toHaveBeenCalled();
      });
    });
  });

  describe("registerStep", () => {
    it("registers system steps and rejects duplicates", async () => {
      const step: any = { id: "sys-step", type: "step", getOptions: () => [], run: jest.fn() };
      await service.registerStep(step, null);
      await expect(service.registerStep(step, null)).rejects.toThrow(
        'System has already registered Step with ID "sys-step"',
      );
      expect(stepsRepo.find).not.toHaveBeenCalled();
    });

    it("registers plugin steps grouped by plugin and rejects duplicate ids", async () => {
      const a: any = { id: "p-a", type: "step", getOptions: () => [], run: jest.fn() };
      const b: any = { id: "p-b", type: "step", getOptions: () => [], run: jest.fn() };
      const c: any = { id: "p-a", type: "step", getOptions: () => [], run: jest.fn() };
      await service.registerStep(a, plugin);
      await service.registerStep(b, plugin);
      await expect(service.registerStep(c, plugin)).rejects.toThrow(
        'Plugin has already registered Step with ID "p-a"',
      );
      const loaded = service.allSteps();
      expect(loaded.filter(({ plugin: p }) => p === plugin)).toHaveLength(2);
    });

    it("bootstraps existing trigger steps with a startup context", async () => {
      const createdContexts: any[] = [];
      const trigger: any = {
        id: "my-trigger",
        type: "trigger",
        getOptions: () => [],
        create: jest.fn((ctx: any) => {
          createdContexts.push(ctx);
          return () => {};
        }),
      };
      stepsRepo.find.mockResolvedValue([
        makeStep({ uuid: "t1", stepId: "my-trigger", stepType: WorkflowStepType.TRIGGER }),
      ]);
      await service.registerStep(trigger, null);

      expect(trigger.create).toHaveBeenCalledTimes(1);
      expect(createdContexts[0].getCreateReason()).toBe("startup");
      expect((service as any).stepDestroyCallbacks.get("t1")).toBeInstanceOf(Function);
    });

    it("queries plugin trigger steps by plugin id", async () => {
      const trigger: any = {
        id: "plug-trigger",
        type: "trigger",
        getOptions: () => [],
        create: jest.fn(() => () => {}),
      };
      await service.registerStep(trigger, plugin);
      expect(stepsRepo.find).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ pluginId: "plugin", stepId: "plug-trigger" }),
        }),
      );
    });
  });

  describe("step contexts", () => {
    let ctx: any;

    beforeEach(async () => {
      let captured: any;
      const trigger: any = {
        id: "ctx-trigger",
        type: "trigger",
        getOptions: () => [],
        create: jest.fn((c: any) => {
          captured = c;
          return () => {};
        }),
      };
      stepsRepo.find.mockResolvedValue([
        makeStep({
          uuid: "step-uuid",
          workflowUuid: "wf-uuid",
          stepId: "ctx-trigger",
          stepType: WorkflowStepType.TRIGGER,
        }),
      ]);
      optionValuesRepo.findBy.mockResolvedValue([
        makeOptionValue({ optionId: "str", value_string: "hello" }),
        makeOptionValue({ optionId: "bool", value_boolean: true }),
        makeOptionValue({ optionId: "int", value_int: 7 }),
        makeOptionValue({ optionId: "dec", value_decimal: 1.5 }),
        makeOptionValue({ optionId: "enum", value_string: "a" }),
        makeOptionValue({ optionId: "bad-enum", value_string: "zzz" }),
      ]);
      await service.registerStep(trigger, null);
      ctx = captured;
    });

    it("exposes step and workflow identity", () => {
      expect(ctx.getStepUuid()).toBe("step-uuid");
      expect(ctx.getWorkflowUuid()).toBe("wf-uuid");
    });

    it("resolves typed options", () => {
      expect(ctx.getOption("str", "string")).toBe("hello");
      expect(ctx.getOption("bool", "boolean")).toBe(true);
      expect(ctx.getOption("int", "integer")).toBe(7);
      expect(ctx.getOption("dec", "decimal")).toBe(1.5);
      expect(ctx.getOption("missing", "string")).toBeNull();
    });

    it("validates enum options against the allowed values", () => {
      expect(ctx.getOption("enum", "enum", ["a", "b"])).toBe("a");
      expect(ctx.getOption("enum", "enum", ["x"])).toBeNull();
      expect(ctx.getOption("bad-enum", "enum", ["a"])).toBeNull();
    });

    it("provides a logger", () => {
      expect(ctx.getLogger()).toBeInstanceOf(Logger);
    });

    it("activate forwards to activateWorkflow", async () => {
      ctx.activate(false);
      await flush();
      expect(workflowsRepo.findOne).toHaveBeenCalledWith(
        expect.objectContaining({ where: { uuid: "wf-uuid" } }),
      );
    });
  });

  describe("createClient", () => {
    it("delegates registerStep with the plugin", async () => {
      const client = service.createClient(plugin);
      const step: any = { id: "client-step", type: "step", getOptions: () => [], run: jest.fn() };
      await client.registerStep(step);
      expect(service.allSteps().some(({ plugin: p, object }) => p === plugin && object.id === "client-step")).toBe(true);
    });
  });

  describe("workflowsRepository wrappers", () => {
    it("findOne returns the workflow with ordered steps", async () => {
      const second = makeStep({ uuid: "s2", previousStepUuid: "s1" });
      const first = makeStep({ uuid: "s1" });
      workflowsRepo.findOne.mockResolvedValue(makeWorkflow({ steps: [second, first] }));
      const workflow = await service.findOne("wf-uuid");
      expect(workflow.steps.map((s: any) => s.uuid)).toEqual(["s1", "s2"]);
    });

    it("findOne leaves missing steps untouched", async () => {
      workflowsRepo.findOne.mockResolvedValue(makeWorkflow({ steps: undefined }));
      const workflow = await service.findOne("wf-uuid");
      expect(workflow.steps).toBeUndefined();
    });

    it("all orders by creation date descending", async () => {
      await service.all();
      expect(workflowsRepo.find).toHaveBeenCalledWith({
        order: { dateCreated: "desc" },
      });
    });

    it("create saves the workflow and tracks its name", async () => {
      const workflow = await service.create("New");
      expect(workflow.uuid).toBe("wf-new");
      expect(workflowsRepo.save).toHaveBeenCalledWith(workflow);
      expect((service as any).workflowNames.get("wf-new")).toBe("New");
    });

    it("delete removes the workflow and its name", async () => {
      (service as any).workflowNames.set("wf-uuid", "Old");
      await service.delete(makeWorkflow());
      expect(workflowsRepo.delete).toHaveBeenCalledWith({ uuid: "wf-uuid" });
      expect((service as any).workflowNames.has("wf-uuid")).toBe(false);
    });
  });

  describe("stepsRepository wrappers", () => {
    it("findStep loads the step with option values", async () => {
      stepsRepo.findOne.mockResolvedValue(makeStep());
      const step = await service.findStep("step-uuid");
      expect(step).toBeDefined();
      expect(stepsRepo.findOne).toHaveBeenCalledWith(
        expect.objectContaining({ relations: { optionValues: true } }),
      );
    });

    it("findWorkflowByStep returns step and workflow", async () => {
      const workflow = makeWorkflow({ steps: [] });
      stepsRepo.findOne.mockResolvedValue(makeStep({ workflow }));
      const result = await service.findWorkflowByStep("step-uuid");
      expect(result.step).toBeDefined();
      expect(result.workflow).toBe(workflow);
    });

    it("findWorkflowByStep returns nulls when the step is missing", async () => {
      stepsRepo.findOne.mockResolvedValue(null);
      await expect(service.findWorkflowByStep("nope")).resolves.toEqual({
        step: null,
        workflow: null,
      });
    });
  });

  describe("removeStep", () => {
    it("throws when the step is not found", async () => {
      stepsRepo.findOne.mockResolvedValue(null);
      await expect(service.removeStep("nope", "wf-uuid")).rejects.toThrow(NotFoundException);
    });

    it("throws when the step belongs to a different workflow", async () => {
      stepsRepo.findOne.mockResolvedValue(
        makeStep({ workflow: makeWorkflow({ uuid: "other" }) }),
      );
      await expect(service.removeStep("step-uuid", "wf-uuid")).rejects.toThrow(BadRequestException);
    });

    it("throws when steps are not included", async () => {
      stepsRepo.findOne.mockResolvedValue(
        makeStep({ workflow: makeWorkflow({ uuid: "wf-uuid", steps: undefined }) }),
      );
      await expect(service.removeStep("step-uuid", "wf-uuid")).rejects.toThrow(
        "Steps not included",
      );
    });

    it("relinks following steps and deletes the step in a transaction", async () => {
      stepsRepo.findOne.mockResolvedValue(
        makeStep({
          uuid: "mid",
          previousStepUuid: "first",
          workflow: makeWorkflow({ uuid: "wf-uuid", steps: [] }),
        }),
      );
      await service.removeStep("mid", "wf-uuid");
      expect(dataSource.transaction).toHaveBeenCalledTimes(1);
      expect(entityManager.update).toHaveBeenNthCalledWith(
        1,
        DBWorkflowStep,
        { uuid: "mid" },
        { previousStepUuid: null },
      );
      expect(entityManager.update).toHaveBeenNthCalledWith(
        2,
        DBWorkflowStep,
        { previousStepUuid: "mid" },
        { previousStepUuid: "first" },
      );
      expect(entityManager.delete).toHaveBeenCalledWith(DBWorkflowStep, { uuid: "mid" });
    });
  });

  describe("allStepsAndTriggers", () => {
    it("merges system and plugin definitions and filters by type", async () => {
      const sysStep: any = { id: "s1", type: "step", getOptions: () => [], run: jest.fn() };
      const sysTrigger: any = { id: "t1", type: "trigger", getOptions: () => [], create: jest.fn() };
      const pluginStep: any = { id: "p1", type: "step", getOptions: () => [], run: jest.fn() };
      await service.registerStep(sysStep, null);
      await service.registerStep(sysTrigger, null);
      await service.registerStep(pluginStep, plugin);

      expect(service.allStepsAndTriggers()).toHaveLength(3);
      expect(service.allTriggers().map(({ object }) => object.id)).toEqual(["t1"]);
      expect(
        service
          .allSteps()
          .map(({ object }) => object.id)
          .sort(),
      ).toEqual(["p1", "s1"]);
    });
  });

  describe("addTrigger", () => {
    const makeTrigger = (objectOverrides: any = {}) => ({
      plugin: null,
      object: {
        id: "trg",
        type: "trigger",
        getOptions: () => [],
        create: jest.fn(() => () => {}),
        ...objectOverrides,
      },
    });

    it("throws when the workflow is not found", async () => {
      await expect(service.addTrigger("nope", makeTrigger() as any)).rejects.toThrow(
        NotFoundException,
      );
    });

    it("throws when steps are not included", async () => {
      entityManager.findOne.mockResolvedValue(makeWorkflow({ uuid: "w1", steps: undefined }));
      await expect(service.addTrigger("w1", makeTrigger() as any)).rejects.toThrow(
        "Steps not included",
      );
    });

    it("throws when the workflow already has a trigger", async () => {
      entityManager.findOne.mockResolvedValue(
        makeWorkflow({
          uuid: "w1",
          steps: [makeStep({ stepType: WorkflowStepType.TRIGGER })],
        }),
      );
      await expect(service.addTrigger("w1", makeTrigger() as any)).rejects.toThrow(
        ConflictException,
      );
    });

    it("inserts the trigger, links the first step, and stores the destroy callback", async () => {
      const first = makeStep({ uuid: "s1" });
      entityManager.findOne.mockResolvedValue(makeWorkflow({ uuid: "w1", steps: [first] }));
      const trigger = makeTrigger();
      await service.addTrigger("w1", trigger as any);

      expect(entityManager.create).toHaveBeenCalledWith(
        DBWorkflowStep,
        expect.objectContaining({
          workflowUuid: "w1",
          pluginId: null,
          stepId: "trg",
          stepType: WorkflowStepType.TRIGGER,
        }),
      );
      expect(entityManager.save).toHaveBeenCalled();
      expect(entityManager.update).toHaveBeenCalledWith(
        DBWorkflowStep,
        { uuid: "s1" },
        { previousStepUuid: "em-new" },
      );
      expect(trigger.object.create).toHaveBeenCalledTimes(1);
      expect((service as any).stepDestroyCallbacks.get("em-new")).toBeInstanceOf(Function);
    });

    it("skips step linking when the workflow has no steps", async () => {
      entityManager.findOne.mockResolvedValue(makeWorkflow({ uuid: "w1", steps: [] }));
      await service.addTrigger("w1", makeTrigger() as any);
      expect(entityManager.update).not.toHaveBeenCalled();
    });

    it("records the plugin id for plugin triggers", async () => {
      entityManager.findOne.mockResolvedValue(makeWorkflow({ uuid: "w1", steps: [] }));
      await service.addTrigger(
        "w1",
        { plugin, object: makeTrigger().object } as any,
      );
      expect(entityManager.create).toHaveBeenCalledWith(
        DBWorkflowStep,
        expect.objectContaining({ pluginId: "plugin" }),
      );
    });
  });

  describe("addStep", () => {
    const makeStepDef = (id = "stp") => ({
      plugin: null,
      object: { id, type: "step", getOptions: () => [], run: jest.fn() },
    });

    it("throws when the workflow is not found", async () => {
      await expect(service.addStep("nope", makeStepDef() as any)).rejects.toThrow(
        NotFoundException,
      );
    });

    it("throws when steps are not included", async () => {
      workflowsRepo.findOne.mockResolvedValue(makeWorkflow({ uuid: "w1", steps: undefined }));
      await expect(service.addStep("w1", makeStepDef() as any)).rejects.toThrow(
        "Steps not included",
      );
    });

    it("appends the step after the last existing step", async () => {
      const first = makeStep({ uuid: "s1" });
      const second = makeStep({ uuid: "s2", previousStepUuid: "s1" });
      workflowsRepo.findOne.mockResolvedValue(makeWorkflow({ uuid: "w1", steps: [second, first] }));
      await service.addStep("w1", makeStepDef() as any);

      expect(stepsRepo.insert).toHaveBeenCalledWith(
        expect.objectContaining({ previousStepUuid: "s2", stepId: "stp", stepType: WorkflowStepType.STEP }),
      );
    });

    it("leaves previousStepUuid unset for the first step", async () => {
      workflowsRepo.findOne.mockResolvedValue(makeWorkflow({ uuid: "w1", steps: [] }));
      await service.addStep("w1", makeStepDef() as any);
      const inserted = stepsRepo.insert.mock.calls[0][0] as any;
      expect(inserted.previousStepUuid).toBeUndefined();
    });

    it("records the plugin id for plugin steps", async () => {
      workflowsRepo.findOne.mockResolvedValue(makeWorkflow({ uuid: "w1", steps: [] }));
      await service.addStep("w1", { plugin, object: makeStepDef().object } as any);
      expect(stepsRepo.insert).toHaveBeenCalledWith(
        expect.objectContaining({ pluginId: "plugin" }),
      );
    });
  });

  describe("updateStepOptions", () => {
    let step: any;

    beforeEach(async () => {
      await service.registerStep(
        {
          id: "opt-step",
          type: "step",
          getOptions: () => [
            { id: "name", type: "string" },
            { id: "count", type: "integer" },
            { id: "mode", type: "enum", enum: [{ id: "a" }, { id: "b" }] },
          ],
          run: jest.fn(),
        },
        null,
      );
      step = makeStep({ uuid: "opt-step-uuid", stepId: "opt-step" });
    });

    it("throws when the step schema is not loaded", async () => {
      await expect(
        service.updateStepOptions(makeStep({ stepId: "missing" }) as any, []),
      ).rejects.toThrow("Step schema is not loaded");
    });

    it("throws for unknown option ids", async () => {
      await expect(
        service.updateStepOptions(step as any, [
          { id: "zzz", type: "string", value: "x" } as any,
        ]),
      ).rejects.toThrow('Step schema doesn\'t contain option "zzz"');
    });

    it("throws for option type mismatches", async () => {
      await expect(
        service.updateStepOptions(step as any, [
          { id: "name", type: "integer", value: 5 } as any,
        ]),
      ).rejects.toThrow('Step option "name" is type "string"');
    });

    it("throws for invalid enum values", async () => {
      await expect(
        service.updateStepOptions(step as any, [
          { id: "mode", type: "enum", value: "zzz" } as any,
        ]),
      ).rejects.toThrow("Invalid enum option specified");
    });

    it("persists typed option values in a transaction", async () => {
      await service.updateStepOptions(step as any, [
        { id: "name", type: "string", value: "n" } as any,
        { id: "count", type: "integer", value: 5 } as any,
        { id: "mode", type: "enum", value: "a" } as any,
      ]);
      expect(entityManager.delete).toHaveBeenCalledWith(DBWorkflowStepOptionValue, {
        stepUuid: "opt-step-uuid",
      });
      expect(entityManager.insert).toHaveBeenCalledWith(DBWorkflowStepOptionValue, [
        { stepUuid: "opt-step-uuid", optionId: "name", value_string: "n" },
        { stepUuid: "opt-step-uuid", optionId: "count", value_int: 5 },
        { stepUuid: "opt-step-uuid", optionId: "mode", value_string: "a" },
      ]);
    });

    it("recreates trigger contexts when trigger options change", async () => {
      const oldDestroy = jest.fn();
      const newDestroy = jest.fn();
      let captured: any;
      await service.registerStep(
        {
          id: "opt-trigger",
          type: "trigger",
          getOptions: () => [{ id: "name", type: "string" }],
          create: jest.fn((ctx: any) => {
            captured = ctx;
            return newDestroy;
          }),
        },
        null,
      );
      const triggerStep = makeStep({ uuid: "trg-uuid", stepId: "opt-trigger" });
      (service as any).stepDestroyCallbacks.set("trg-uuid", oldDestroy);

      await service.updateStepOptions(triggerStep as any, [
        { id: "name", type: "string", value: "updated" } as any,
      ]);

      expect(oldDestroy).toHaveBeenCalledTimes(1);
      expect(captured.getCreateReason()).toBe("options-update");
      expect((service as any).stepDestroyCallbacks.get("trg-uuid")).toBe(newDestroy);
    });
  });

  describe("activateWorkflow", () => {
    const registerStepDef = (id: string, run: (ctx: any) => Promise<void>) =>
      service.registerStep(
        { id, type: "step", getOptions: () => [], run },
        null,
      );

    it("rejects when the workflow does not exist", async () => {
      await expect(service.activateWorkflow("nope", false)).rejects.toThrow(NotFoundException);
    });

    it("rejects when the workflow has no steps", async () => {
      workflowsRepo.findOne.mockResolvedValue(makeWorkflow({ uuid: "w1", steps: undefined }));
      await expect(service.activateWorkflow("w1", false)).rejects.toThrow(
        "Workflow didn't include steps",
      );
    });

    it("completes the workflow and reports complete to waiters", async () => {
      let release: () => void;
      const gate = new Promise<void>((r) => (release = r));
      await registerStepDef("s1", async () => {
        await gate;
      });
      workflowsRepo.findOne.mockResolvedValue(
        makeWorkflow({
          uuid: "w1",
          steps: [makeStep({ uuid: "db1", stepId: "s1", workflowUuid: "w1" })],
        }),
      );
      const activation = service.activateWorkflow("w1", false);
      await flush();
      const wait = service.waitForWorkflow("w1");
      release!();
      const reason = await wait;
      await activation;
      expect(reason).toBe("complete");
      expect(service.getActive("w1")).toBeNull();
    });

    it("reports error when a step definition is missing", async () => {
      let resolveGate: () => void;
      const gate = new Promise<void>((r) => (resolveGate = r));
      await registerStepDef("gate", async () => {
        await gate;
      });
      workflowsRepo.findOne.mockResolvedValue(
        makeWorkflow({
          uuid: "w1",
          steps: [
            makeStep({ uuid: "db1", stepId: "gate", workflowUuid: "w1" }),
            makeStep({
              uuid: "db2",
              stepId: "unknown",
              workflowUuid: "w1",
              previousStepUuid: "db1",
            }),
          ],
        }),
      );
      const activation = service.activateWorkflow("w1", false);
      await flush();
      const wait = service.waitForWorkflow("w1");
      resolveGate!();
      const reason = await wait;
      await activation;
      expect(reason).toBe("error");
      expect(service.getActive("w1")).toBeNull();
    });

    it("reports error when a step throws", async () => {
      let resolveGate: () => void;
      const gate = new Promise<void>((r) => (resolveGate = r));
      await registerStepDef("gate", async () => {
        await gate;
      });
      await registerStepDef("boom", async () => {
        throw new Error("boom");
      });
      workflowsRepo.findOne.mockResolvedValue(
        makeWorkflow({
          uuid: "w1",
          steps: [
            makeStep({ uuid: "db1", stepId: "gate", workflowUuid: "w1" }),
            makeStep({
              uuid: "db2",
              stepId: "boom",
              workflowUuid: "w1",
              previousStepUuid: "db1",
            }),
          ],
        }),
      );
      const activation = service.activateWorkflow("w1", false);
      await flush();
      const wait = service.waitForWorkflow("w1");
      resolveGate!();
      const reason = await wait;
      await activation;
      expect(reason).toBe("error");
    });

    it("reports error when step option values are missing", async () => {
      let resolveGate: () => void;
      const gate = new Promise<void>((r) => (resolveGate = r));
      await registerStepDef("gate", async () => {
        await gate;
      });
      await registerStepDef("no-options", async () => {});
      workflowsRepo.findOne.mockResolvedValue(
        makeWorkflow({
          uuid: "w1",
          steps: [
            makeStep({ uuid: "db1", stepId: "gate", workflowUuid: "w1" }),
            makeStep({
              uuid: "db2",
              stepId: "no-options",
              workflowUuid: "w1",
              previousStepUuid: "db1",
              optionValues: undefined,
            }),
          ],
        }),
      );
      const activation = service.activateWorkflow("w1", false);
      await flush();
      const wait = service.waitForWorkflow("w1");
      resolveGate!();
      const reason = await wait;
      await activation;
      expect(reason).toBe("error");
    });

    it("forwards clamped step progress to waiters", async () => {
      let release: () => void;
      const gate = new Promise<void>((r) => (release = r));
      await registerStepDef("s1", async (ctx: any) => {
        await gate;
        ctx.updateProgress(0.5);
        ctx.updateProgress(2);
      });
      await registerStepDef("s2", async (ctx: any) => {
        ctx.updateProgress(0.5);
        ctx.updateProgress(1);
      });
      workflowsRepo.findOne.mockResolvedValue(
        makeWorkflow({
          uuid: "w1",
          steps: [
            makeStep({ uuid: "db1", stepId: "s1", workflowUuid: "w1" }),
            makeStep({
              uuid: "db2",
              stepId: "s2",
              workflowUuid: "w1",
              previousStepUuid: "db1",
            }),
          ],
        }),
      );
      const progress: number[] = [];
      const activation = service.activateWorkflow("w1", false);
      await flush();
      const wait = service.waitForWorkflow("w1", (p) => progress.push(p));
      release!();
      await wait;
      await activation;
      expect(progress).toEqual([0.25, 0.5, 0.75, 1]);
    });

    it("tracks current step state on the active workflow", async () => {
      let release: () => void;
      const gate = new Promise<void>((r) => (release = r));
      await registerStepDef("gate", async () => {
        await gate;
      });
      workflowsRepo.findOne.mockResolvedValue(
        makeWorkflow({
          uuid: "w1",
          steps: [makeStep({ uuid: "db1", stepId: "gate", workflowUuid: "w1" })],
        }),
      );
      const activation = service.activateWorkflow("w1", false);
      await flush();
      const active = service.getActive("w1")!;
      expect(active.currentStepIndex).toBe(0);
      expect(active.currentStepUuid).toBe("db1");
      expect(active.totalSteps).toBe(1);
      expect(active.stepPercent).toBeNull();
      release!();
      await activation;
    });

    it("resolves immediately when the workflow is already active", async () => {
      let release: () => void;
      const gate = new Promise<void>((r) => (release = r));
      await registerStepDef("gate", async () => {
        await gate;
      });
      workflowsRepo.findOne.mockResolvedValue(
        makeWorkflow({
          uuid: "w1",
          steps: [makeStep({ uuid: "db1", stepId: "gate", workflowUuid: "w1" })],
        }),
      );
      const first = service.activateWorkflow("w1", false);
      await flush();
      await expect(service.activateWorkflow("w1", false)).resolves.toBeUndefined();
      expect(service.getActive("w1")!.hasPendingRerun).toBe(false);
      release!();
      await first;
      await sleep(10);
      expect(service.getActive("w1")).toBeNull();
    });

    it("re-runs the workflow when a rerun was requested", async () => {
      let runs = 0;
      let release: () => void;
      const gate = new Promise<void>((r) => (release = r));
      await registerStepDef("gate", async () => {
        runs++;
        await gate;
      });
      workflowsRepo.findOne.mockResolvedValue(
        makeWorkflow({
          uuid: "w1",
          steps: [makeStep({ uuid: "db1", stepId: "gate", workflowUuid: "w1" })],
        }),
      );

      const first = service.activateWorkflow("w1", false);
      await flush();
      expect(runs).toBe(1);
      await service.activateWorkflow("w1", true);
      expect(service.getActive("w1")!.hasPendingRerun).toBe(true);

      release!();
      await first;
      await flush();
      await flush();
      expect(runs).toBe(2);
      expect(service.getActive("w1")).toBeNull();
    });
  });

  describe("waitForWorkflow", () => {
    it("resolves not-running for inactive workflows", async () => {
      await expect(service.waitForWorkflow("nope")).resolves.toBe("not-running");
    });
  });
});
