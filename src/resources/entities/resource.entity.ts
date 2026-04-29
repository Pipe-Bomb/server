import path from "path";
import { Column, Entity, PrimaryGeneratedColumn } from "typeorm";
import { ResourceResponse } from "../response/resource.response";

const RESOURCES_DIRECTORY = "./resources";

@Entity("resources")
export class DBResource {
	@PrimaryGeneratedColumn("uuid")
	uuid: string;

	@Column({
		type: "text",
	})
	sha256: string;

	@Column({
		type: "text",
	})
	extension: string;

	getFilePath() {
		return path.join(
			RESOURCES_DIRECTORY,
			this.uuid.substring(0, 3),
			`${this.uuid}.${this.extension}`,
		);
	}

	toResponse(): ResourceResponse {
		return {
			uuid: this.uuid,
			extension: this.extension,
			sha256: this.sha256,
			url: `/resources/${this.uuid.substring(0, 3)}/${this.uuid}.${this.extension}`,
		};
	}
}
