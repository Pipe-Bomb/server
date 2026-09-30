import { BadRequestException, NotFoundException } from "@nestjs/common";
import { Test, TestingModule } from "@nestjs/testing";
import { WorkflowsController } from "./workflows.controller";
import { WorkflowsService } from "./workflows.service";
import { PrivilegesService } from "src/privileges/privileges.service";

const mockWorkflowsService = {
	all: jest.fn(),
	findOne: jest.fn(),
	create: jest.fn(),
	delete: jest.fn(),
	addTrigger: jest.fn(),
	allTriggers: jest.fn(),
	allSteps: jest.fn(),
	addStep: jest.fn(),
	removeStep: jest.fn(),
	findStep: jest.fn(),
	updateStepOptions: jest.fn(),
	getActive: jest.fn(),
	allStepsAndTriggers: jest.fn(),
};

const mockPrivilegesService = {
	registerPrivilege: jest.fn(),
};

const fakeStepLoaded = {
	plugin: { package: { name: "plug" } },
	object: { id: "step1" },
};

const fakeTriggerLoaded = {
	plugin: null,
	object: { id: "trigger1" },
};

describe("WorkflowsController", () => {
	let controller: WorkflowsController;
	let fakeWorkflow: {
		uuid: string;
		name: string;
		toResponse: jest.Mock;
	};

	beforeEach(async () => {
		jest.clearAllMocks();
		fakeWorkflow = {
			uuid: "w-uuid",
			name: "Test Workflow",
			toResponse: jest
				.fn()
				.mockReturnValue({ uuid: "w-uuid", name: "Test Workflow" }),
		};

		mockWorkflowsService.all.mockResolvedValue([fakeWorkflow]);
		mockWorkflowsService.findOne.mockResolvedValue(fakeWorkflow);
		mockWorkflowsService.create.mockResolvedValue(fakeWorkflow);
		mockWorkflowsService.allStepsAndTriggers.mockReturnValue([]);
		mockWorkflowsService.getActive.mockReturnValue(null);

		const module: TestingModule = await Test.createTestingModule({
			controllers: [WorkflowsController],
			providers: [
				{ provide: WorkflowsService, useValue: mockWorkflowsService },
				{ provide: PrivilegesService, useValue: mockPrivilegesService },
			],
		}).compile();

		controller = module.get<WorkflowsController>(WorkflowsController);
	});

	it("registers the workflow privileges on construction", () => {
		expect(mockPrivilegesService.registerPrivilege).toHaveBeenCalledWith(
			null,
			"edit-workflows",
		);
		expect(mockPrivilegesService.registerPrivilege).toHaveBeenCalledWith(null, "view-workflows", [
			"edit-workflows",
		]);
	});

	describe("getAll", () => {
		it("maps every workflow to its response", async () => {
			const result = await controller.getAll();

			expect(mockWorkflowsService.all).toHaveBeenCalledTimes(1);
			expect(fakeWorkflow.toResponse).toHaveBeenCalledWith([], null);
			expect(result).toEqual([{ uuid: "w-uuid", name: "Test Workflow" }]);
		});
	});

	describe("getWorkflow", () => {
		it("returns the workflow response", async () => {
			const result = await controller.getWorkflow("w-uuid");

			expect(mockWorkflowsService.findOne).toHaveBeenCalledWith("w-uuid");
			expect(result).toEqual({ uuid: "w-uuid", name: "Test Workflow" });
		});

		it("throws NotFoundException when the workflow does not exist", async () => {
			mockWorkflowsService.findOne.mockResolvedValue(null);

			await expect(controller.getWorkflow("missing")).rejects.toThrow(
				NotFoundException,
			);
		});
	});

	describe("createWorkflow", () => {
		it("creates the workflow with the DTO name", async () => {
			const result = await controller.createWorkflow({ name: "New Workflow" } as never);

			expect(mockWorkflowsService.create).toHaveBeenCalledWith("New Workflow");
			expect(result).toEqual({ uuid: "w-uuid", name: "Test Workflow" });
		});
	});

	describe("deleteWorkflow", () => {
		it("deletes the found workflow", async () => {
			await controller.deleteWorkflow("w-uuid");

			expect(mockWorkflowsService.findOne).toHaveBeenCalledWith("w-uuid");
			expect(mockWorkflowsService.delete).toHaveBeenCalledWith(fakeWorkflow);
		});

		it("throws NotFoundException when the workflow does not exist", async () => {
			mockWorkflowsService.findOne.mockResolvedValue(null);

			await expect(controller.deleteWorkflow("missing")).rejects.toThrow(
				NotFoundException,
			);
		});
	});

	describe("addTrigger", () => {
		it("throws NotFoundException when no trigger matches", async () => {
			mockWorkflowsService.allTriggers.mockReturnValue([]);

			await expect(
				controller.addTrigger("w-uuid", { pluginId: null, stepId: "nope" } as never),
			).rejects.toThrow("Trigger not found");
			expect(mockWorkflowsService.addTrigger).not.toHaveBeenCalled();
		});

		it("adds the matching trigger and returns the updated workflow", async () => {
			mockWorkflowsService.allTriggers.mockReturnValue([fakeTriggerLoaded]);

			const result = await controller.addTrigger("w-uuid", {
				pluginId: null,
				stepId: "trigger1",
			} as never);

			expect(mockWorkflowsService.addTrigger).toHaveBeenCalledWith(
				"w-uuid",
				fakeTriggerLoaded,
			);
			expect(result).toEqual({ uuid: "w-uuid", name: "Test Workflow" });
		});
	});

	describe("addStep", () => {
		it("throws NotFoundException when no step matches", async () => {
			mockWorkflowsService.allSteps.mockReturnValue([]);

			await expect(
				controller.addStep("w-uuid", { pluginId: "plug", stepId: "nope" } as never),
			).rejects.toThrow("Step not found");
			expect(mockWorkflowsService.addStep).not.toHaveBeenCalled();
		});

		it("adds the matching step and returns the updated workflow", async () => {
			mockWorkflowsService.allSteps.mockReturnValue([fakeStepLoaded]);

			const result = await controller.addStep("w-uuid", {
				pluginId: "plug",
				stepId: "step1",
			} as never);

			expect(mockWorkflowsService.addStep).toHaveBeenCalledWith("w-uuid", fakeStepLoaded);
			expect(result).toEqual({ uuid: "w-uuid", name: "Test Workflow" });
		});
	});

	describe("deleteStep", () => {
		it("removes the step and returns the updated workflow", async () => {
			const result = await controller.deleteStep("w-uuid", "s-uuid");

			expect(mockWorkflowsService.removeStep).toHaveBeenCalledWith("s-uuid", "w-uuid");
			expect(result).toEqual({ uuid: "w-uuid", name: "Test Workflow" });
		});
	});

	describe("updateStepOptions", () => {
		it("throws NotFoundException when the step does not exist", async () => {
			mockWorkflowsService.findStep.mockResolvedValue(null);

			await expect(
				controller.updateStepOptions("w-uuid", "missing", { options: [] } as never),
			).rejects.toThrow("Step not found");
		});

		it("throws BadRequestException when the step belongs to another workflow", async () => {
			mockWorkflowsService.findStep.mockResolvedValue({
				uuid: "s-uuid",
				workflowUuid: "other-uuid",
			});

			await expect(
				controller.updateStepOptions("w-uuid", "s-uuid", { options: [] } as never),
			).rejects.toThrow(BadRequestException);
		});

		it("updates the options and returns the updated workflow", async () => {
			const dbStep = {
				uuid: "s-uuid",
				workflowUuid: "w-uuid",
				pluginId: null,
				stepId: "step1",
			};
			mockWorkflowsService.findStep.mockResolvedValue(dbStep);

			const result = await controller.updateStepOptions("w-uuid", "s-uuid", {
				options: [{ id: "opt", type: "string", value: "v" }],
			} as never);

			expect(mockWorkflowsService.updateStepOptions).toHaveBeenCalledWith(dbStep, [
				{ id: "opt", type: "string", value: "v" },
			]);
			expect(result).toEqual({ uuid: "w-uuid", name: "Test Workflow" });
		});
	});
});
