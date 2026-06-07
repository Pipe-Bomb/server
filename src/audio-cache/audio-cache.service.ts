import { Injectable, Logger } from "@nestjs/common";
import { DBTrack } from "src/tracks/entities/track.entity";
import FFmpeg from "fluent-ffmpeg";
import { createHash, randomUUID } from "crypto";
import path from "path";
import { createReadStream, createWriteStream, existsSync } from "fs";
import { mkdir, rm, stat, rename, copyFile, unlink, lstat } from "fs/promises";
import Mime from "mime";
import { finished } from "stream/promises";
import { TasksService } from "src/tasks/tasks.service";
import { LoadedLibraryHandler } from "src/libraries/interface/loaded-library.interface";
import { StreamingCoreService } from "src/streaming-core/streaming-core.service";
import { StreamStreamInstance } from "src/streaming-core/stream-instance/stream.stream-instance";
import { HLSStreamInstance } from "src/streaming-core/stream-instance/hls.stream-instance";
import { AudioProducer, AudioProducerType, LibraryHandler } from "@sdk";
import { parseStream } from "music-metadata";

@Injectable()
export class AudioCacheService {
	private readonly logger = new Logger("Audio Cache Service");

	constructor(
		private readonly tasksService: TasksService,
		private readonly streamingCoreService: StreamingCoreService,
	) {
		// this.tasksService.registerSystemTask({
		// 	id: "cache-all-libraries",
		// 	resumable: false,
		// 	run: async (context) => {
		// 		const libraries = this.librariesService.allFlat();
		// 		for (const library of libraries) {
		// 		}
		// 	},
		// });
	}

	private getPath(pluginId: string, libraryId: string, trackId: string) {
		const hash = createHash("sha256").update(trackId).digest("hex");
		return path.join(
			"audio-cache",
			pluginId,
			libraryId,
			hash.substring(0, 3),
			hash,
		);
	}

	private async requestTempDirectory() {
		let dir: string;
		do {
			dir = path.join("temp", randomUUID());
		} while (existsSync(dir));
		await mkdir(dir);
		return dir;
	}

	async getAudioProducer(
		handler: LibraryHandler,
		pluginId: string,
		trackId: string,
		type: AudioProducerType | null,
	): Promise<AudioProducer | null> {
		const filePath = this.getPath(pluginId, handler.id, trackId);

		if ((!type || type == "stream") && existsSync(filePath)) {
			return {
				type: "stream",
				cacheable: false,
				getMetadata: async () => {
					const stats = await stat(filePath);

					return {
						size: stats.size,
						mimeType: "audio/mpeg", // mp3 mime type
					};
				},
				getStream: async () => createReadStream(filePath),
				getDuration: async () => {
					const metadata = await parseStream(createReadStream(filePath));
					if (metadata.format.duration) {
						return metadata.format.duration;
					}
					throw new Error("Failed to get duration");
				},
				getPart: async (start, end) =>
					createReadStream(filePath, {
						start,
						end,
					}),
			};
		}

		return handler.getAudioProducer(trackId, type);
	}

	async cacheTrack(library: LoadedLibraryHandler, track: DBTrack) {
		const filePath = this.getPath(
			track.pluginId,
			track.libraryId,
			track.trackId,
		);
		const fileDir = path.dirname(filePath);
		if (existsSync(filePath)) {
			return false;
		}

		const producer = await library.handler.getAudioProducer(
			track.trackId,
			null,
		);

		if (!producer) {
			throw new Error("Unable to create Audio Producer");
		}

		if (!producer.cacheable) {
			this.logger.debug("Session's Audio Producer is not cacheable");
			return false;
		}

		const instance = this.streamingCoreService.createStreamInstance(producer);

		const tempDir = await this.requestTempDirectory();
		try {
			if (instance instanceof StreamStreamInstance) {
				const metadata = await instance.getProducer().getMetadata();
				const extension = Mime.getExtension(metadata.mimeType);
				if (!extension) {
					throw new Error(
						`Unknown file extension from mime type "${metadata.mimeType}"`,
					);
				}
				const tempFile = path.join(tempDir, `temp.${extension}`);
				const input = await instance.getStream();
				const output = createWriteStream(tempFile);
				input.pipe(output);
				await finished(output);
				const stats = await lstat(tempFile);
				if (!stats.size) {
					this.logger.warn(
						"Rejected a cached audio candidate because its size was 0",
					);
					return false;
				}
				await mkdir(fileDir, {
					recursive: true,
				});
				try {
					await rename(tempFile, filePath);
				} catch (e: any) {
					if ("code" in e && e.code == "EXDEV") {
						await copyFile(tempFile, filePath);
						await unlink(tempFile);
					} else {
						throw e;
					}
				}

				return true;
			}

			if (instance instanceof HLSStreamInstance) {
				const playlistUrl = `http://127.0.0.1:3000/streaming/${instance.id}/hls/playlist.m3u8`;

				// todo: evaluate use of 320k mp3
				const tempFile = path.join(tempDir, `temp.mp3`);
				await new Promise<void>((resolve, reject) => {
					console.log("Starting FFmpeg...");
					FFmpeg(playlistUrl)
						// .inputOptions([
						// 	// "-reconnect 1",
						// 	// "-reconnect_at_eof 1",
						// 	// "-reconnect_streamed 1",
						// 	// "-reconnect_delay_max 5",
						// ])
						.inputOptions([
							"-probesize 10M", // Analyze up to 10MB to find a valid stream
							"-analyzeduration 10M", // Analyze for 10 seconds of data
						])
						.noVideo()
						.audioCodec("libmp3lame")
						.audioBitrate("320k")
						.on("error", (e) => {
							console.error(e);
							reject(e);
						})
						.on("end", () => {
							console.log("FFmpeg finished");
							resolve();
						})
						// .on("stderr", (stderrLine) => {
						// 	console.log("FFmpeg Output: " + stderrLine);
						// })
						.save(tempFile);
				});
				await mkdir(fileDir, {
					recursive: true,
				});
				try {
					await rename(tempFile, filePath);
				} catch (e: any) {
					if ("code" in e && e.code == "EXDEV") {
						await copyFile(tempFile, filePath);
						await unlink(tempFile);
					} else {
						throw e;
					}
				}
				return true;
			}
		} catch (e) {
			throw e;
		} finally {
			rm(tempDir, {
				recursive: true,
				force: true,
			}).catch((e) =>
				this.logger.error(`Failed to remove temp directory "${tempDir}":`, e),
			);
		}

		return false;
	}
}
