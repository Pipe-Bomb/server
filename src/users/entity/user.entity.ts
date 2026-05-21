import { Column, Entity, Index, PrimaryGeneratedColumn } from "typeorm";
import { UserResponse } from "../response/user.response";

@Entity("users")
export class DBUser {
	@PrimaryGeneratedColumn("uuid")
	uuid: string;

	@Column({
		type: "text",
	})
	@Index({
		unique: true,
	})
	username: string;

	@Column({
		type: "text",
	})
	passwordHash: string;

	@Column({
		type: "text",
	})
	passwordSalt: string;

	toResponse(): UserResponse {
		return {
			uuid: this.uuid,
			username: this.username,
		};
	}
}
