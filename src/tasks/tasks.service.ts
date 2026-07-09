import {
	BadRequestException,
	ConflictException,
	Injectable,
	Logger,
	NotFoundException,
} from "@nestjs/common";
import {
	EnumWorkflowOptionItem,
	SimpleTask,
	SubTask,
	Task,
	TaskRunContext,
} from "@sdk";
import { LoadedPlugin } from "src/plugins/interface/loaded-plugin.interface";
import { TaskResponse, TaskStatusResponse } from "./response/task.response";
import { randomUUID } from "crypto";
import { InjectRepository } from "@nestjs/typeorm";
import { DBResumableTaskProgress } from "./entity/resumable-task-progress.entity";
import { FindOptionsWhere, Repository } from "typeorm";
import { LoadedTask } from "./interface/loaded-task.interface";
import { WorkflowsService } from "src/workflows/workflows.service";

interface ActiveTask extends LoadedTask {
	percent: number | null;
	runId: string;
}

@Injectable()
export class TasksService {
	private readonly logger = new Logger("Tasks Service");
	private readonly tasks = new Map<string, LoadedTask>();
	private readonly activePluginTasks: ActiveTask[] = [];

	constructor(
		@InjectRepository(DBResumableTaskProgress)
		private readonly resumableTaskProgressRepository: Repository<DBResumableTaskProgress>,
		private readonly workflowsService: WorkflowsService,
	) {
		const getTaskEnums: () => EnumWorkflowOptionItem<string>[] = () => {
			return [
				...this.allSystemTasks().flatMap(({ task }) => {
					if ("getSubTasks" in task) {
						const subTasks = task.getSubTasks();
						return subTasks.map((subTask) => ({
							id: `:${task.id}:${subTask}`,
							languageKey: `task.system.${task.id}.subtask.${subTask}.name`,
						}));
					} else {
						return [
							{
								id: `:${task.id}:`,
								languageKey: `task.system.${task.id}.name`,
							},
						];
					}
				}),
				...this.allPluginTasks().flatMap(({ task, plugin }) => {
					if ("getSubTasks" in task) {
						const subTasks = task.getSubTasks();
						return subTasks.map((subTask) => ({
							id: `${plugin!.package.name}:${task.id}:${subTask}`,
							languageKey: `task.plugin.${plugin!.package.name}.${task.id}.subtask.${subTask}.name`,
						}));
					} else {
						return [
							{
								id: `${plugin!.package.name}:${task.id}:`,
								languageKey: `task.plugin.${plugin!.package.name}.${task.id}.name`,
							},
						];
					}
				}),
			];
		};

		this.workflowsService.registerStep(
			{
				type: "step",
				id: "run-task",
				getOptions: () => [
					{
						type: "enum",
						id: "taskId",
						enum: getTaskEnums(),
					},
				],
				run: async (ctx) => {
					const serializedTaskId = ctx.getOption(
						"taskId",
						"enum",
						getTaskEnums().map(({ id }) => id),
					);
					if (!serializedTaskId) {
						throw new Error("Unspecified task");
					}

					const [pluginId, taskId, subtaskId] = serializedTaskId.split(":");
					if (!taskId) {
						throw new Error("Malformed task ID");
					}

					for (const [uuid, { task, plugin }] of this.tasks.entries()) {
						if (task.id != taskId) {
							continue;
						}
						if ((plugin?.package.name ?? null) != (pluginId || null)) {
							continue;
						}

						if ("getSubTasks" in task) {
							const subtasks = task.getSubTasks();
							if (!subtaskId || !subtasks.includes(subtaskId)) {
								throw new Error("Invalid or unspecified subtask ID");
							}
							await this.runTask(uuid, subtaskId);
						} else {
							if (subtaskId) {
								throw new Error("Subtask ID specified for simple task");
							}
							await this.runTask(uuid, null);
						}
					}
				},
			},
			null,
		);
	}

	private generateTaskId() {
		let uuid: string;
		do {
			uuid = randomUUID();
		} while (this.tasks.has(uuid));
		return uuid;
	}

	private async generateRunId() {
		let runId: string;
		do {
			runId = randomUUID();
		} while (
			this.activePluginTasks.some((active) => active.runId == runId) ||
			(await this.resumableTaskProgressRepository.countBy({
				runId,
			}))
		);
		return runId;
	}

	registerSystemTask(task: SimpleTask): void;
	registerSystemTask<T extends string = string>(task: SubTask<T>): void;
	registerSystemTask(task: Task) {
		for (const existingTask of this.tasks.values()) {
			if (!existingTask.plugin && task.id == existingTask.task.id) {
				throw new Error(
					`System has already registered task with ID "${task.id}"`,
				);
			}
		}

		const uuid = this.generateTaskId();
		this.tasks.set(uuid, {
			uuid,
			task,
			plugin: null,
		});

		this.logger.debug(`System registered task "${task.id}"`);
	}

	registerPluginTask(task: Task, plugin: LoadedPlugin) {
		for (const existingTask of this.tasks.values()) {
			if (
				existingTask.plugin &&
				task.id == existingTask.task.id &&
				existingTask.plugin.package.name == plugin.package.name
			) {
				throw new Error(
					`Plugin "${plugin.package.name}" has already registered task with ID "${task.id}"`,
				);
			}
		}

		const uuid = this.generateTaskId();
		this.tasks.set(uuid, {
			uuid,
			task,
			plugin,
		});

		this.logger.log(
			`Plugin "${plugin.package.name}" registered task "${task.id}"`,
		);
	}

	allTasks() {
		return Array.from(this.tasks.values());
	}

	allPluginTasks() {
		return this.allTasks().filter((task) => task.plugin);
	}

	allResumableProgresses() {
		const conditions: FindOptionsWhere<DBResumableTaskProgress>[] =
			this.allTasks()
				.filter((task) => task.task.resumable)
				.map((task) => ({
					pluginId: task.plugin?.package.name ?? "",
					taskId: task.task.id,
				}));

		return this.resumableTaskProgressRepository.findBy(conditions);
	}

	allSystemTasks() {
		return this.allTasks().filter((task) => !task.plugin);
	}

	toResponse(
		{ plugin, task, uuid }: LoadedTask,
		resumableProgress: DBResumableTaskProgress | null,
	): TaskResponse {
		const activeTask = this.activePluginTasks.find((task) => task.uuid == uuid);

		let subTasks: string[] | null = null;

		if ("getSubTasks" in task) {
			subTasks = [...task.getSubTasks()];
		}

		if (subTasks && !subTasks.length) {
			subTasks = null;
		}

		return {
			uuid,
			taskId: task.id,
			subTasks,
			pluginId: plugin?.package.name ?? null,
			status: activeTask
				? TaskStatusResponse.RUNNING
				: resumableProgress
					? TaskStatusResponse.SUSPENDED
					: TaskStatusResponse.STOPPED,
			percent:
				typeof activeTask?.percent == "number"
					? activeTask.percent * 100
					: resumableProgress && resumableProgress.progress >= 0
						? resumableProgress.progress * 100
						: null,
			resumable: task.resumable,
		};
	}

	findTask(plugin: LoadedPlugin | null, taskId: string) {
		for (const task of this.tasks.values()) {
			if (
				((plugin && task.plugin?.package.name == plugin.package.name) ||
					(!plugin && !task.plugin)) &&
				task.task.id == taskId
			) {
				return task;
			}
		}
		return null;
	}

	async runTask(uuid: string, subTask: string | null) {
		if (
			this.activePluginTasks.some((existingTask) => existingTask.uuid == uuid)
		) {
			throw new ConflictException("Task is already running");
		}

		const task = this.tasks.get(uuid);
		if (!task) {
			throw new NotFoundException("Task does not exist");
		}

		let runId: string;
		let startingProgress = 0;
		let isResuming = false;

		if (task.task.resumable) {
			const resumableProgress =
				await this.resumableTaskProgressRepository.findOneBy({
					pluginId: task.plugin?.package.name ?? "",
					taskId: task.task.id,
				});
			if (resumableProgress) {
				runId = resumableProgress.runId;
				startingProgress = Math.max(0, resumableProgress.progress);
				isResuming = true;
				subTask = resumableProgress.subTaskId;
			} else {
				runId = await this.generateRunId();
				const newResumableProgress =
					this.resumableTaskProgressRepository.create({
						pluginId: task.plugin?.package.name ?? "",
						taskId: task.task.id,
						subTaskId: subTask,
						progress: -1,
						runId,
					});
				await this.resumableTaskProgressRepository.insert(newResumableProgress);
			}
		} else {
			runId = await this.generateRunId();
		}

		if (!isResuming) {
			if ("getSubTasks" in task.task) {
				if (!subTask) {
					throw new BadRequestException("SubTask ID not specified");
				}
				if (!task.task.getSubTasks().includes(subTask)) {
					throw new NotFoundException("SubTask does not exist");
				}
			} else {
				if (subTask) {
					throw new BadRequestException("SubTask ID specified for simple task");
				}
			}
		}

		const activeTask: ActiveTask = {
			...task,
			percent: null,
			runId,
		};

		this.activePluginTasks.push(activeTask);
		const title = task.plugin
			? `Plugin "${task.plugin.package.name}"'s Task "${task.task.id}"`
			: `SYSTEM Task "${task.task.id}"`;
		this.logger.log(`Started ${title}`);

		let lastResumeUpdateTime = 0;
		let isUpdatingTime = false;
		const context: TaskRunContext = {
			update: (percent) => {
				const normalized = Math.max(Math.min(percent, 1), 0);
				const newPercent =
					startingProgress + normalized * (1 - startingProgress);

				activeTask.percent = newPercent;
				this.logger.debug(
					`${title} is at ${Math.round(activeTask.percent * 1000) / 10}%`,
				);
				if (task.task.resumable && !isUpdatingTime) {
					if (lastResumeUpdateTime + 5_000 < Date.now()) {
						isUpdatingTime = true;
						this.resumableTaskProgressRepository
							.update(
								{
									runId,
								},
								{
									progress: activeTask.percent,
								},
							)
							.catch((e) =>
								this.logger.error(
									`Failed to store Task progress for "${task.task.id}":`,
									e,
								),
							)
							.finally(() => {
								isUpdatingTime = false;
								lastResumeUpdateTime = Date.now();
							});
					}
				}
			},
			getRunId: () => runId,
		};

		let promise: Promise<void>;
		if ("getSubTasks" in task.task) {
			promise = task.task.run(context, subTask!);
		} else {
			promise = task.task.run(context);
		}

		promise
			.then(() => {
				this.logger.log(`Finished ${title}`);
			})
			.catch((e) => {
				this.logger.error(`${title} failed with error:`, e);
			})
			.finally(() => {
				const index = this.activePluginTasks.indexOf(activeTask);
				if (index >= 0) {
					this.activePluginTasks.splice(index, 1);
				}
				if (task.task.resumable) {
					this.resumableTaskProgressRepository
						.delete({
							runId,
						})
						.catch((e) =>
							this.logger.error(
								`Failed to remove Task progress for "${task.task.id}":`,
								e,
							),
						);
				}
			});
	}
}
