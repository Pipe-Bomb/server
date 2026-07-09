import {
	BadRequestException,
	ConflictException,
	Injectable,
	Logger,
	NotFoundException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import {
	BaseWorkflowStepContext,
	WorkflowClient,
	WorkflowStep,
	WorkflowStepContext,
	WorkflowTrigger,
	WorkflowTriggerContext,
} from "sdk/workflow-client";
import { LoadedPlugin } from "src/plugins/interface/loaded-plugin.interface";
import { DBWorkflow } from "./entity/workflow.entity";
import { IsNull, Repository } from "typeorm";
import { DBWorkflowStep } from "./entity/workflow-step.entity";
import { orderWorkflowSteps } from "./workflows.util";
import { Loaded, OptionalLoaded } from "src/types/loaded";
import { WorkflowStepType } from "./enum/workflow-step-type.enum";
import { DataSource } from "typeorm";
import { WorkflowStepOptionValueDto } from "./dto/workflow-step-option-value.dto";
import { DBWorkflowStepOptionValue } from "./entity/workflow-step-option-value.entity";
import { WorkflowStepOptionType } from "./enum/workflow-step-option-type.enum";
import { CronJob, validateCronExpression } from "cron";
import { ActiveWorkflow } from "./interface/active-workflow.interface";

@Injectable()
export class WorkflowsService {
	private readonly logger = new Logger("Workflows Service");
	private readonly pluginSteps = new Map<
		string,
		Map<string, Loaded<WorkflowStep | WorkflowTrigger>>
	>();
	private readonly systemSteps = new Map<
		string,
		WorkflowStep | WorkflowTrigger
	>();
	private readonly stepDestroyCallbacks = new Map<string, () => void>();
	private readonly activeWorkflows = new Map<string, ActiveWorkflow>();

	constructor(
		@InjectRepository(DBWorkflow)
		private readonly workflowsRepository: Repository<DBWorkflow>,
		@InjectRepository(DBWorkflowStep)
		private readonly workflowStepsRepository: Repository<DBWorkflowStep>,
		@InjectRepository(DBWorkflowStepOptionValue)
		private readonly workflowStepOptionValuesRepository: Repository<DBWorkflowStepOptionValue>,
		private readonly dataSource: DataSource,
	) {
		this.registerStep(
			{
				id: "server-start",
				type: "trigger",
				getOptions: () => [],
				create: (ctx) => {
					if (ctx.getCreateReason() == "startup") {
						ctx.activate(false);
					}

					return () => {};
				},
			},
			null,
		);

		this.registerStep(
			{
				id: "cron",
				type: "trigger",
				getOptions: () => [
					{
						id: "schedule",
						type: "string",
					},
					{
						id: "rerun",
						type: "boolean",
					},
				],
				create: (ctx) => {
					const logger = ctx.getLogger();
					const schedule = ctx.getOption("schedule", "string");
					if (!schedule) {
						logger.warn(`Cron won't run because expression isn't specified`);
						return () => {};
					}

					const { valid } = validateCronExpression(schedule);
					if (!valid) {
						this.logger.warn(`Cron won't run because expression is invalid`);
						return () => {};
					}

					const job = new CronJob(schedule, () =>
						ctx.activate(!!ctx.getOption("rerun", "boolean")),
					);
					job.start();

					return () => job.stop();
				},
			},
			null,
		);
	}

	async registerStep(
		step: WorkflowTrigger | WorkflowStep,
		plugin: LoadedPlugin | null,
	) {
		if (plugin) {
			const pluginMap = this.pluginSteps.get(plugin.package.name);
			if (pluginMap) {
				if (pluginMap.has(step.id)) {
					throw new Error(
						`Plugin has already registered Step with ID "${step.id}"`,
					);
				}
				pluginMap.set(step.id, { plugin, object: step });
			} else {
				this.pluginSteps.set(
					plugin.package.name,
					new Map([[step.id, { plugin, object: step }]]),
				);
			}
			this.logger.log(
				`Plugin "${plugin.package.name}" registered Workflow ${step.type == "trigger" ? "Trigger" : "Step"} "${step.id}"`,
			);
		} else {
			if (this.systemSteps.has(step.id)) {
				throw new Error(
					`System has already registered Step with ID "${step.id}"`,
				);
			}
			this.systemSteps.set(step.id, step);
			this.logger.log(
				`System registered Workflow ${step.type == "trigger" ? "Trigger" : "Step"} "${step.id}"`,
			);
		}

		if (step.type == "trigger") {
			const triggerSteps = await this.workflowStepsRepository.find({
				where: {
					pluginId: plugin ? plugin.package.name : IsNull(),
					stepId: step.id,
					stepType: WorkflowStepType.TRIGGER,
				},
			});

			for (const triggerStep of triggerSteps) {
				const deleteCallback = step.create(
					await this.createTriggerContext(triggerStep, "startup"),
				);
				this.stepDestroyCallbacks.set(triggerStep.uuid, deleteCallback);
			}
		}
	}

	private createBaseContext(
		step: DBWorkflowStep,
		options: DBWorkflowStepOptionValue[],
	): BaseWorkflowStepContext {
		return {
			getWorkflowUuid: () => step.workflowUuid,
			getOption: (id, type, ...args) => {
				const option = options.find((option) => option.optionId == id);
				if (!option) {
					return null;
				}
				switch (type) {
					case "string":
						return option.value_string;
					case "boolean":
						return option.value_boolean;
					case "decimal":
						return option.value_decimal;
					case "integer":
						return option.value_int;
				}
				if (type == "enum") {
					const options = args[0];
					if (
						options &&
						option.value_string &&
						options.includes(option.value_string as any)
					) {
						return option.value_string;
					}
					return null;
				}
				return null;
			},
			getLogger: () => new Logger(`WORKFLOW STEP ${step.stepId}`),
		};
	}

	private async createTriggerContext(
		step: DBWorkflowStep,
		createReason: ReturnType<WorkflowTriggerContext["getCreateReason"]>,
	): Promise<WorkflowTriggerContext> {
		const options = await this.workflowStepOptionValuesRepository.findBy({
			stepUuid: step.uuid,
		});

		return {
			...this.createBaseContext(step, options),
			getCreateReason: () => createReason,
			activate: (allowRerun) => {
				this.activateWorkflow(step.workflowUuid, allowRerun).catch((e) =>
					this.logger.error(`Failed to start Workflow from Trigger:`, e),
				);
			},
		};
	}

	private createStepContext(
		step: DBWorkflowStep,
		options: DBWorkflowStepOptionValue[],
		onProgress: (percent: number) => void,
	): WorkflowStepContext {
		return {
			...this.createBaseContext(step, options),
			updateProgress: onProgress,
		};
	}

	createClient(plugin: LoadedPlugin): WorkflowClient {
		return {
			registerStep: (step) => this.registerStep(step, plugin),
		};
	}

	async findOne(uuid: string) {
		const workflow = await this.workflowsRepository.findOne({
			where: {
				uuid,
			},
			relations: {
				steps: {
					optionValues: true,
				},
			},
		});
		if (workflow?.steps) {
			workflow.steps = orderWorkflowSteps(workflow.steps);
		}
		return workflow;
	}

	all() {
		return this.workflowsRepository.find({
			order: {
				dateCreated: "desc",
			},
		});
	}

	async create(name: string) {
		const workflow = this.workflowsRepository.create({
			name,
		});

		await this.workflowsRepository.save(workflow);
		return workflow;
	}

	async delete(workflow: DBWorkflow) {
		await this.workflowsRepository.delete({
			uuid: workflow.uuid,
		});
	}

	findStep(stepUuid: string) {
		return this.workflowStepsRepository.findOne({
			where: {
				uuid: stepUuid,
			},
			relations: {
				optionValues: true,
			},
		});
	}

	async findWorkflowByStep(stepUuid: string) {
		const step = await this.workflowStepsRepository.findOne({
			where: {
				uuid: stepUuid,
			},
			relations: {
				workflow: {
					steps: {
						optionValues: true,
					},
				},
			},
		});

		if (step) {
			return {
				step,
				workflow: step.workflow!,
			};
		}
		return {
			step: null,
			workflow: null,
		};
	}

	async removeStep(stepUuid: string, workflowUuid: string) {
		const { step, workflow } = await this.findWorkflowByStep(stepUuid);
		if (!step) {
			throw new NotFoundException("Step not found");
		}
		if (workflow.uuid != workflowUuid) {
			throw new BadRequestException("Step is not a part of workflow");
		}
		if (!workflow.steps) {
			throw new Error("Steps not included");
		}
		await this.dataSource.transaction(async (entityManager) => {
			await entityManager.update(
				DBWorkflowStep,
				{
					previousStepUuid: step.uuid,
				},
				{
					previousStepUuid: step.previousStepUuid,
				},
			);
			await entityManager.delete(DBWorkflowStep, {
				uuid: step.uuid,
			});
		});
	}

	allStepsAndTriggers(): OptionalLoaded<WorkflowTrigger | WorkflowStep>[] {
		return [
			...Array.from(this.systemSteps.values()).map((object) => ({
				plugin: null,
				object,
			})),
			...Array.from(this.pluginSteps.values()).flatMap((steps) =>
				Array.from(steps.values()),
			),
		];
	}

	allTriggers() {
		return this.allStepsAndTriggers().filter(
			(step) => step.object.type == "trigger",
		) as OptionalLoaded<WorkflowTrigger>[];
	}

	allSteps() {
		return this.allStepsAndTriggers().filter(
			(step) => step.object.type == "step",
		) as OptionalLoaded<WorkflowStep>[];
	}

	async addTrigger(
		workflowUuid: string,
		trigger: OptionalLoaded<WorkflowTrigger>,
	) {
		await this.dataSource.transaction(async (entityManager) => {
			const workflow = await entityManager.findOne(DBWorkflow, {
				where: {
					uuid: workflowUuid,
				},
				relations: {
					steps: true,
				},
			});

			if (!workflow) {
				throw new NotFoundException("Workflow not found");
			}
			if (!workflow.steps) {
				throw new Error("Steps not included");
			}

			if (
				workflow.steps.some((step) => step.stepType == WorkflowStepType.TRIGGER)
			) {
				throw new ConflictException("Workflow already has Trigger");
			}

			const dbTrigger = entityManager.create(DBWorkflowStep, {
				workflowUuid: workflow.uuid,
				pluginId: trigger.plugin?.package.name ?? null,
				stepId: trigger.object.id,
				stepType: WorkflowStepType.TRIGGER,
			});
			await entityManager.save(DBWorkflowStep, dbTrigger);

			const orderedSteps = orderWorkflowSteps(workflow.steps);
			if (orderedSteps.length) {
				const firstStep = orderedSteps[0];
				firstStep.previousStepUuid = dbTrigger.uuid;
				await entityManager.update(
					DBWorkflowStep,
					{
						uuid: firstStep.uuid,
					},
					{
						previousStepUuid: dbTrigger.uuid,
					},
				);
			}

			const deleteCallback = trigger.object.create(
				await this.createTriggerContext(dbTrigger, "trigger-add"),
			);
			this.stepDestroyCallbacks.set(dbTrigger.uuid, deleteCallback);
		});
	}

	async addStep(workflowUuid: string, step: OptionalLoaded<WorkflowStep>) {
		const workflow = await this.workflowsRepository.findOne({
			where: {
				uuid: workflowUuid,
			},
			relations: {
				steps: true,
			},
		});

		if (!workflow) {
			throw new NotFoundException("Workflow not found");
		}
		if (!workflow.steps) {
			throw new Error("Steps not included");
		}

		const orderedSteps = orderWorkflowSteps(workflow.steps);
		const newStep = this.workflowStepsRepository.create({
			workflowUuid: workflow.uuid,
			pluginId: step.plugin?.package.name ?? null,
			stepId: step.object.id,
			stepType: WorkflowStepType.STEP,
		});
		if (orderedSteps.length) {
			newStep.previousStepUuid = orderedSteps[orderedSteps.length - 1].uuid;
		}

		await this.workflowStepsRepository.insert(newStep);
	}

	async updateStepOptions(
		step: DBWorkflowStep,
		options: WorkflowStepOptionValueDto[],
	) {
		const loadedStep = this.allStepsAndTriggers().find(
			({ plugin, object }) =>
				(plugin?.package.name ?? null) == step.pluginId &&
				object.id == step.stepId,
		);
		if (!loadedStep) {
			throw new Error("Step schema is not loaded");
		}

		const optionSchemas = loadedStep.object.getOptions();

		for (const option of options) {
			const matchingSchema = optionSchemas.find(
				(schema) => schema.id == option.id,
			);
			if (!matchingSchema) {
				throw new BadRequestException(
					`Step schema doesn't contain option "${option.id}"`,
				);
			}
			if (option.type != matchingSchema.type) {
				throw new BadRequestException(
					`Step option "${option.id}" is type "${matchingSchema.type}"`,
				);
			}
			if (matchingSchema.type == "enum") {
				if (!matchingSchema.enum.some((item) => item.id == option.value)) {
					throw new BadRequestException(`Invalid enum option specified`);
				}
			}
		}

		await this.dataSource.transaction(async (entityManager) => {
			await entityManager.delete(DBWorkflowStepOptionValue, {
				stepUuid: step.uuid,
			});

			await entityManager.insert(
				DBWorkflowStepOptionValue,
				options.map((option) => {
					const entity: Partial<DBWorkflowStepOptionValue> = {
						stepUuid: step.uuid,
						optionId: option.id,
					};

					if (
						option.type == WorkflowStepOptionType.STRING ||
						option.type == WorkflowStepOptionType.ENUM
					) {
						entity.value_string = option.value;
					}
					if (option.type == WorkflowStepOptionType.BOOLEAN) {
						entity.value_boolean = option.value;
					}
					if (option.type == WorkflowStepOptionType.INTEGER) {
						entity.value_int = option.value;
					}
					if (option.type == WorkflowStepOptionType.DECIMAL) {
						entity.value_decimal = option.value;
					}

					return entity;
				}),
			);
		});

		if (loadedStep.object.type == "trigger") {
			const trigger = loadedStep.object;

			const deleteCallback = this.stepDestroyCallbacks.get(step.uuid);
			deleteCallback?.();

			const newDeleteCallback = trigger.create(
				await this.createTriggerContext(step, "options-update"),
			);
			this.stepDestroyCallbacks.set(step.uuid, newDeleteCallback);
		}
	}

	getActive(uuid: string) {
		return this.activeWorkflows.get(uuid) ?? null;
	}

	async activateWorkflow(workflowUuid: string, allowRerun: boolean) {
		const workflow = await this.workflowsRepository.findOne({
			where: {
				uuid: workflowUuid,
			},
			relations: {
				steps: {
					optionValues: true,
				},
			},
		});

		if (!workflow) {
			throw new NotFoundException("Workflow doesn't exist");
		}

		if (!workflow.steps) {
			throw new Error("Workflow didn't include steps");
		}

		const existingActiveWorkflow = this.activeWorkflows.get(workflowUuid);
		if (existingActiveWorkflow) {
			if (allowRerun) {
				this.logger.debug(
					`Workflow "${workflow.name}" is already running, requesting a re-run`,
				);
				existingActiveWorkflow.hasPendingRerun = true;
			} else {
				this.logger.debug(`Workflow "${workflow.name}" is already running`);
			}
			return;
		}
		this.logger.log(`Activating workflow "${workflow.name}"`);

		const steps = orderWorkflowSteps(workflow.steps).filter(
			(step) => step.stepType != WorkflowStepType.TRIGGER,
		);

		this.logger.debug(`Workflow "${workflow.name}" has ${steps.length} steps`);
		const stepDefinitions = this.allSteps();

		const activeWorkflow: ActiveWorkflow = {
			uuid: workflow.uuid,
			currentStepIndex: 1,
			currentStepUuid: "",
			hasPendingRerun: false,
			stepPercent: null,
			totalSteps: steps.length,
		};
		this.activeWorkflows.set(workflow.uuid, activeWorkflow);

		try {
			for (const [index, step] of steps.entries()) {
				this.logger.debug(
					`Running step ${index + 1} of workflow "${workflow.name}"`,
				);
				activeWorkflow.currentStepIndex = index;
				activeWorkflow.currentStepUuid = step.uuid;
				activeWorkflow.stepPercent = null;
				const definition = stepDefinitions.find(
					({ plugin, object }) =>
						(plugin?.package.name ?? null) == step.pluginId &&
						object.id == step.stepId,
				);
				if (!definition) {
					throw new Error(`Step definition ${step.stepId} is not defined`);
				}
				if (!step.optionValues) {
					throw new Error(`Step option values not defined`);
				}
				const ctx = this.createStepContext(
					step,
					step.optionValues,
					(percent) => {
						activeWorkflow.stepPercent = percent;
						this.logger.debug(
							`Workflow "${workflow.name}" step ${index + 1} is at ${Math.round(percent * 1000) / 10}%`,
						);
					},
				);
				await definition.object.run(ctx);
			}
		} catch (e) {
			this.logger.error(`Failed to complete workflow "${workflow.name}":`, e);
		} finally {
			setImmediate(() => {
				this.activeWorkflows.delete(workflow.uuid);
				if (activeWorkflow.hasPendingRerun) {
					this.logger.debug(`Re-running workflow "${workflow.name}"`);
					this.activateWorkflow(workflow.uuid, false);
				}
			});
		}
	}
}
