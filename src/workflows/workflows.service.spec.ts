import { Test, TestingModule } from "@nestjs/testing";
import { WorkflowsService } from "./workflows.service";

describe("WorkflowsService", () => {
	let service: WorkflowsService;

	beforeEach(async () => {
		const module: TestingModule = await Test.createTestingModule({
			providers: [WorkflowsService],
		}).compile();

		service = module.get<WorkflowsService>(WorkflowsService);
	});

	it("should be defined", () => {
		expect(service).toBeDefined();
	});
});
