import { Injectable } from "@nestjs/common";
import { randomBytes } from "crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import { writeFile } from "fs/promises";
import path from "path";

@Injectable()
export class SecretsService {
	private readonly secrets = new Map<string, string>();

	constructor() {
		if (!existsSync(".secrets")) {
			mkdirSync(".secrets");
		}
	}

	private getPath(id: string) {
		return path.join(".secrets", id);
	}

	getOrCreate(id: string, create: string | (() => string)) {
		let secret = this.secrets.get(id);
		if (secret) {
			return secret;
		}
		const file = this.getPath(id);
		try {
			secret = readFileSync(file).toString("utf-8");
			if (!secret) {
				throw "nonexistent";
			}
		} catch {
			console.log(`Generating secret "${id}"`);
			if (typeof create == "string") {
				secret = create;
			} else {
				secret = create();
			}
			writeFileSync(file, secret);
		}
		this.secrets.set(id, secret);
		return secret;
	}

	get(id: string) {
		const secret = this.secrets.get(id);
		if (secret) {
			return secret;
		}
		throw new Error(`Secret "${id}" not found`);
	}

	set(id: string, value: string) {
		console.log(id, value);
		return writeFile(this.getPath(id), value);
	}

	createAuthSecret() {
		let secret: string | undefined;
		do {
			const length = 900 + Math.floor(Math.random() * 100);
			const rawSecret = randomBytes(length).toString("base64");
			secret = rawSecret.match(/.{1,50}/g)?.join("\n");
		} while (!secret);
		return secret;
	}
}
