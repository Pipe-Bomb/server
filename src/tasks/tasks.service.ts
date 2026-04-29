import {
	ConflictException,
	Injectable,
	Logger,
	NotFoundException,
} from "@nestjs/common";
import { Task } from "@sdk";
import { LoadedPlugin } from "src/plugins/interface/loaded-plugin.interface";
import { TaskResponse } from "./response/task.response";
import { randomUUID } from "crypto";

interface LoadedTask {
	task: Task;
	uuid: string;
	plugin: LoadedPlugin | null;
}

interface ActiveTask extends LoadedTask {
	percent: number | null;
}

@Injectable()
export class TasksService {
	private readonly logger = new Logger("Tasks Service");
	private readonly tasks = new Map<string, LoadedTask>();
	private readonly activePluginTasks: ActiveTask[] = [];

	private generateTaskId() {
		let uuid: string;
		do {
			uuid = randomUUID();
		} while (this.tasks.has(uuid));
		return uuid;
	}

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

	allPluginTasks() {
		return Array.from(this.tasks.values()).filter((task) => task.plugin);
	}

	allSystemTasks() {
		return Array.from(this.tasks.values()).filter((task) => !task.plugin);
	}

	toResponse({ plugin, task, uuid }: LoadedTask): TaskResponse {
		const activeTask = this.activePluginTasks.find((task) => task.uuid == uuid);

		return {
			uuid,
			taskId: task.id,
			pluginId: plugin?.package.name ?? null,
			inProgress: !!activeTask,
			percent:
				typeof activeTask?.percent == "number"
					? activeTask.percent * 100
					: null,
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

	runTask(uuid: string) {
		if (
			this.activePluginTasks.some((existingTask) => existingTask.uuid == uuid)
		) {
			throw new ConflictException("Task is already running");
		}

		const task = this.tasks.get(uuid);
		if (!task) {
			throw new NotFoundException("Task does not exist");
		}

		const activeTask: ActiveTask = {
			...task,
			percent: null,
		};

		this.activePluginTasks.push(activeTask);
		const title = task.plugin
			? `Plugin "${task.plugin.package.name}"'s Task "${task.task.id}"`
			: `SYSTEM Task "${task.task.id}"`;
		this.logger.log(`Started ${title}`);
		task.task
			.run({
				update: (percent) => {
					activeTask.percent = Math.max(Math.min(percent, 1), 0);
					this.logger.debug(
						`${title} is at ${Math.round(activeTask.percent * 1000) / 10}%`,
					);
				},
			})
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
			});
	}
}
