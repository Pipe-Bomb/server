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
import { Brackets, QueryDeepPartialEntity, Repository } from "typeorm";
import { LoadedTask } from "./interface/loaded-task.interface";
import { WorkflowsService } from "src/workflows/workflows.service";
import { DBTaskHistory } from "./entity/task-history.entity";
import { TaskHistoryResult } from "./enum/task-history-result.enum";

interface ActiveTask extends LoadedTask {
	percent: number | null;
	runId: string;
	endCallbacks: Set<() => void>;
	progressCallbacks: Set<(percent: number) => void>;
}

@Injectable()
export class TasksService {
	private readonly logger = new Logger("Tasks Service");
	private readonly tasks = new Map<string, LoadedTask>();
	private readonly activePluginTasks: ActiveTask[] = [];

	constructor(
		@InjectRepository(DBResumableTaskProgress)
		private readonly resumableTaskProgressRepository: Repository<DBResumableTaskProgress>,
		@InjectRepository(DBTaskHistory)
		private readonly taskHistoryRepository: Repository<DBTaskHistory>,
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
						await this.waitForTask(uuid, (percent) =>
							ctx.updateProgress(percent),
						);
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
			(await this.resumableTaskProgressRepository.existsBy({
				runId,
			})) ||
			(await this.taskHistoryRepository.existsBy({ runId }))
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

	allSystemTasks() {
		return this.allTasks().filter((task) => !task.plugin);
	}

	async toResponse(tasks: LoadedTask[]): Promise<TaskResponse[]> {
		if (!tasks.length) {
			return [];
		}

		const getKey = (pluginId: string, taskId: string) =>
			`${pluginId}\u0000${taskId}`;

		const progressConditions = tasks
			.filter(({ task }) => task.resumable)
			.map(({ plugin, task }) => ({
				pluginId: plugin?.package.name ?? "",
				taskId: task.id,
			}));

		const [progresses, histories] = await Promise.all([
			progressConditions.length
				? this.resumableTaskProgressRepository.findBy(progressConditions)
				: Promise.resolve([] as DBResumableTaskProgress[]),
			this.getLatestTaskHistories(tasks),
		]);

		const progressByTask = new Map<string, DBResumableTaskProgress>();
		for (const progress of progresses) {
			progressByTask.set(getKey(progress.pluginId, progress.taskId), progress);
		}

		const historyByTask = new Map<string, DBTaskHistory>();
		for (const history of histories) {
			historyByTask.set(getKey(history.pluginId, history.taskId), history);
		}

		const activeTaskByUuid = new Map<string, ActiveTask>();
		for (const activeTask of this.activePluginTasks) {
			activeTaskByUuid.set(activeTask.uuid, activeTask);
		}

		return tasks.map(({ plugin, task, uuid }) => {
			const pluginId = plugin?.package.name ?? "";
			const activeTask = activeTaskByUuid.get(uuid);
			const resumableProgress =
				progressByTask.get(getKey(pluginId, task.id)) ?? null;
			const history = historyByTask.get(getKey(pluginId, task.id)) ?? null;

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
				lastRun: history
					? {
							result: history.result,
							duration: history.duration,
							dateStarted: new Date(history.dateStarted),
							subTaskId: history.subTaskId,
						}
					: null,
			};
		});
	}

	private async getLatestTaskHistories(
		tasks: LoadedTask[],
	): Promise<DBTaskHistory[]> {
		const parameters: Record<string, string> = {};

		const query = this.taskHistoryRepository
			.createQueryBuilder("history")
			.where(
				new Brackets((where) => {
					tasks.forEach(({ plugin, task }, index) => {
						parameters[`pluginId${index}`] = plugin?.package.name ?? "";
						parameters[`taskId${index}`] = task.id;

						where.orWhere(
							new Brackets((condition) => {
								condition
									.where(`history.pluginId = :pluginId${index}`)
									.andWhere(`history.taskId = :taskId${index}`);
							}),
						);
					});
				}),
			);
		query.setParameters(parameters);

		const newerHistory = query
			.subQuery()
			.select("1")
			.from(DBTaskHistory, "newer")
			.where("newer.pluginId = history.pluginId")
			.andWhere("newer.taskId = history.taskId")
			.andWhere(
				new Brackets((where) => {
					where.where("newer.dateStarted > history.dateStarted").orWhere(
						new Brackets((tie) => {
							tie
								.where("newer.dateStarted = history.dateStarted")
								.andWhere("newer.runId > history.runId");
						}),
					);
				}),
			)
			.getQuery();

		return query.andWhere(`NOT EXISTS ${newerHistory}`).getMany();
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
			endCallbacks: new Set(),
			progressCallbacks: new Set(),
		};

		this.activePluginTasks.push(activeTask);
		const title = task.plugin
			? `Plugin "${task.plugin.package.name}"'s Task "${task.task.id}"`
			: `SYSTEM Task "${task.task.id}"`;
		this.logger.log(`Started ${title}`);
		const dateStarted = Date.now();

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
				for (const progressCallbacks of activeTask.progressCallbacks) {
					progressCallbacks(newPercent);
				}
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

		const entity: QueryDeepPartialEntity<DBTaskHistory> = {
			runId,
			pluginId: task.plugin?.package.name ?? "",
			taskId: task.task.id,
			subTaskId: subTask,
			dateStarted,
		};

		promise
			.then(() => {
				this.logger.log(`Finished ${title}`);

				entity.result = TaskHistoryResult.COMPLETED;
			})
			.catch((e) => {
				this.logger.error(`${title} failed with error:`, e);
				entity.result = TaskHistoryResult.FAILED;
			})
			.finally(async () => {
				entity.duration = Date.now() - dateStarted;
				await this.taskHistoryRepository.insert(entity);

				const index = this.activePluginTasks.indexOf(activeTask);
				if (index >= 0) {
					this.activePluginTasks.splice(index, 1);
				}
				for (const callback of activeTask.endCallbacks) {
					callback();
				}
				activeTask.endCallbacks.clear();
				activeTask.progressCallbacks.clear();
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

	waitForTask(uuid: string, onProgress?: (percent: number) => void) {
		return new Promise<void>((resolve) => {
			const task = this.activePluginTasks.find((task) => task.uuid == uuid);
			if (!task) {
				return resolve();
			}
			task.progressCallbacks.add((percent) => onProgress?.(percent));
			task.endCallbacks.add(resolve);
		});
	}
}
