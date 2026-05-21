import {
	ConflictException,
	Injectable,
	UnauthorizedException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { DBUser } from "./entity/user.entity";
import { Repository } from "typeorm";
import { SecretsService } from "src/secrets/secrets.service";
import * as crypto from "crypto";
import { JwtService } from "@nestjs/jwt";
import { UserJwtPayload } from "./interface/user-jwt-payload.interface";

@Injectable()
export class UsersService {
	private readonly jwtSecret: string;

	constructor(
		@InjectRepository(DBUser)
		private readonly usersRepository: Repository<DBUser>,
		private readonly secretsService: SecretsService,
		private readonly jwtService: JwtService,
	) {
		this.jwtSecret = this.secretsService.getOrCreate("user-jwt", () =>
			this.secretsService.createAuthSecret(),
		);
	}

	private generatePasswordHash(password: string, salt: Buffer) {
		return new Promise<string>((resolve, reject) => {
			crypto.scrypt(
				password,
				salt,
				64,
				{
					N: 16384,
					r: 8,
					p: 1,
				},
				(error, key) => {
					if (error) {
						reject(error);
					} else {
						resolve(key.toString("hex"));
					}
				},
			);
		});
	}

	async create(username: string, password: string) {
		username = username.toLowerCase();

		// todo: username validation

		const existingUser = await this.usersRepository.findOneBy({
			username,
		});
		if (existingUser) {
			throw new ConflictException("Username is taken");
		}

		const salt = crypto.randomBytes(16);
		const hash = await this.generatePasswordHash(password, salt);

		const user = this.usersRepository.create({
			username,
			passwordHash: hash,
			passwordSalt: salt.toString("hex"),
		});

		await this.usersRepository.insert(user);
		return user;
	}

	async login(username: string, password: string) {
		const user = await this.usersRepository.findOneBy({
			username,
		});

		if (!user) {
			throw new UnauthorizedException("Invalid username or password");
		}

		const hash = await this.generatePasswordHash(
			password,
			Buffer.from(user.passwordSalt, "hex"),
		);

		if (hash !== user.passwordHash) {
			throw new UnauthorizedException("Invalid username or password");
		}

		return user;
	}

	generateJwt(user: DBUser) {
		const payload: UserJwtPayload = {
			sub: user.uuid,
		};

		return this.jwtService.signAsync(payload, {
			expiresIn: "30d",
			secret: this.jwtSecret,
		});
	}

	async parseJwt(jwt: string) {
		try {
			const payload: UserJwtPayload = await this.jwtService.verifyAsync(jwt, {
				secret: this.jwtSecret,
			});
			return payload;
		} catch {
			throw new UnauthorizedException();
		}
	}

	findOne(uuid: string) {
		return this.usersRepository.findOneBy({
			uuid,
		});
	}
}
