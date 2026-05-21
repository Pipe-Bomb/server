import { Controller } from "@nestjs/common";
import { SecretsService } from "./secrets.service";

@Controller()
export class SecretsController {
	constructor(private readonly secretsService: SecretsService) {}
}
