import {
	BadRequestException,
	ForbiddenException,
	Injectable,
} from "@nestjs/common";
import { AttributeUploadSession } from "./interface/attribute-upload-session.interface";
import { randomUUID } from "crypto";
import { AttributeUploadSessionResponse } from "./response/attribute-upload-session.response";
import { RelativeUrl } from "src/interception/relative-url";
import { DBUser } from "src/users/entity/user.entity";

@Injectable()
export class AttributeUploadService {
	private readonly sessions = new Map<string, AttributeUploadSession>();

	createSession(
		user: DBUser,
		attributeKey: string,
		attributeExtension: string,
		resolve: (buffer: Buffer) => void,
		reject: (error: Error) => void,
	): AttributeUploadSessionResponse {
		let uuid: string;
		do {
			uuid = randomUUID();
		} while (this.sessions.has(uuid));

		const session: AttributeUploadSession = {
			uuid,
			userUuid: user.uuid,
			resolve,
			reject,
			extend: () => {
				if (session.timeout) {
					clearTimeout(session.timeout);
				}
				session.timeout = setTimeout(() => {
					this.sessions.delete(uuid);
					reject(new Error("Attribute upload session timed out"));
				}, 30_000);
			},
			timeout: null,
		};
		session.extend();

		this.sessions.set(uuid, session);

		return {
			uuid,
			key: attributeKey,
			extension: attributeExtension,
			url: new RelativeUrl(`/attributes/buffer/${uuid}`),
		};
	}

	resolveSession(uuid: string, buffer: Buffer, user: DBUser) {
		const session = this.sessions.get(uuid);
		if (!session) {
			throw new BadRequestException("Upload session doesn't exist");
		}
		if (session.userUuid != user.uuid) {
			throw new ForbiddenException();
		}
		session.resolve(buffer);
		if (session.timeout) {
			clearTimeout(session.timeout);
		}
		this.sessions.delete(session.uuid);
	}
}
