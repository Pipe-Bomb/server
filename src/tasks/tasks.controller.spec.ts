import { Test, TestingModule } from "@nestjs/testing";
import { TasksController } from "./tasks.controller";
import { TasksService } from "./tasks.service";
import { PrivilegesService } from "src/privileges/privileges.service";
import { TaskResponse } from "./response/task.response";

const mockTasksService = {
  allPluginTasks: jest.fn().mockReturnValue([]),
  allSystemTasks: jest.fn().mockReturnValue([]),
  allResumableProgresses: jest.fn().mockReturnValue([]),
  toResponse: jest.fn((task, progress) => ({
	uuid: task.uuid,
	taskId: task.task.id,
	pluginId: task.plugin?.package?.name ?? null,
	status: "stopped",
	percent: null,
	resumable: task.task.resumable,
  })),
  runTask: jest.fn().mockResolvedValue(undefined),
};

const mockPrivilegesService = {
  registerPrivilege: jest.fn(),
};

describe("TasksController", () => {
  let controller: TasksController;
  let service: typeof mockTasksService;

  beforeEach(async () => {
	const module: TestingModule = await Test.createTestingModule({
	  controllers: [TasksController],
	  providers: [
		{ provide: TasksService, useValue: mockTasksService },
		{ provide: PrivilegesService, useValue: mockPrivilegesService },
	  ],
	}).compile();

	controller = module.get<TasksController>(TasksController);
	service = module.get<TasksService>(TasksService) as any;
  });

  afterEach(() => {
	jest.clearAllMocks();
  });

  it("should return all tasks mapped to responses", async () => {
	const pluginTask = { uuid: "p1", task: { id: "pt", resumable: false }, plugin: { package: { name: "plug" } } };
	const systemTask = { uuid: "s1", task: { id: "st", resumable: false }, plugin: null };
	mockTasksService.allPluginTasks.mockReturnValue([pluginTask]);
	mockTasksService.allSystemTasks.mockReturnValue([systemTask]);
	mockTasksService.allResumableProgresses.mockReturnValue([]);

	const result = await controller.all();
	expect(service.allPluginTasks).toHaveBeenCalledTimes(1);
	expect(service.allSystemTasks).toHaveBeenCalledTimes(1);
	expect(service.allResumableProgresses).toHaveBeenCalledTimes(1);
	expect(result).toEqual({
	  pluginTasks: [mockTasksService.toResponse(pluginTask, null)],
	  systemTasks: [mockTasksService.toResponse(systemTask, null)],
	});
  });

  it("should call runTask when starting a task", async () => {
	const uuid = "test-uuid";
	const dto = { subTask: "sub1" } as any;
	await controller.start(uuid, dto);
	expect(service.runTask).toHaveBeenCalledWith(uuid, "sub1");
  });
});
