import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";
import { DocumentBuilder, getSchemaPath, SwaggerModule } from "@nestjs/swagger";
import packageJson from "../package.json";
import { DocsService } from "./docs/docs.service";
import { ValidationPipe } from "@nestjs/common";
import {
	PersistentBooleanAttributeResponse,
	PersistentBufferAttributeResponse,
	PersistentDecimalAttributeResponse,
	PersistentIntegerAttributeResponse,
	PersistentStringAttributeResponse,
} from "./attributes/response/persistent-attribute.response";
import { AttributeType } from "./attributes/enum/attribute-type.enum";
import { AttributeSourcesService } from "./attribute-sources/attribute-sources.service";
import { AttributeInterceptor } from "./attribute-sources/attribute.interceptor";
import { mkdir, rm } from "fs/promises";
import { NestExpressApplication } from "@nestjs/platform-express";
import cookieParser from "cookie-parser";
import * as DotEnv from "dotenv";
import { ErrorResponse } from "./response/error.response";

DotEnv.config({
	quiet: true,
});

async function bootstrap() {
	try {
		await rm("temp", {
			recursive: true,
		});
	} catch {}
	await mkdir("temp");

	const app = await NestFactory.create<NestExpressApplication>(AppModule);
	app.enableCors({
		origin: process.env.CORS || "http://127.0.0.1:3001",
		credentials: true,
	});
	app.set("trust proxy", 1);
	app.use(cookieParser());

	app.useGlobalPipes(new ValidationPipe({ transform: true, whitelist: true }));

	const attributesService = app.get(AttributeSourcesService);
	app.useGlobalInterceptors(new AttributeInterceptor(attributesService));

	const swaggerConfig = new DocumentBuilder()
		.setTitle("Pipe Bomb API")
		.setVersion(packageJson.version)
		.setOpenAPIVersion("3.1.0")
		.build();

	// mkdirSync("openapi", { recursive: true });
	const swaggerDocument = SwaggerModule.createDocument(app, swaggerConfig, {
		extraModels: [ErrorResponse],
		operationIdFactory: (_controllerKey, methodKey) => methodKey,
	});

	const defaultErrorResponse = {
		description: "Default error response",
		content: {
			"application/json": {
				schema: {
					$ref: getSchemaPath(ErrorResponse),
				},
			},
		},
	};

	// default to ErrorResponse for 4xx-5xx
	for (const pathObj of Object.values(swaggerDocument.paths)) {
		for (const operation of Object.values(pathObj)) {
			if (operation && typeof operation === "object" && operation.responses) {
				for (const [statusCode, responseObj] of Object.entries(
					operation.responses,
				)) {
					const statusNum = parseInt(statusCode, 10);

					const isErrorStatus =
						(statusNum >= 400 && statusNum < 600) ||
						statusCode === "default" ||
						statusCode === "4XX" ||
						statusCode === "5XX";

					if (isErrorStatus) {
						const response = responseObj as any;

						if (!response.content) {
							response.content = {
								"application/json": {
									schema: {
										$ref: getSchemaPath(ErrorResponse),
									},
								},
							};
						} else if (!response.content["application/json"]?.schema) {
							response.content["application/json"] = {
								schema: {
									$ref: getSchemaPath(ErrorResponse),
								},
							};
						}
					}
				}

				const has5xx = Object.keys(operation.responses).some((code) =>
					code.startsWith("5"),
				);
				if (!has5xx) {
					operation.responses["5XX"] = defaultErrorResponse;
				}
			}
		}
	}

	swaggerDocument.components!.schemas!["AttributeMap"] = {
		type: "object",
		additionalProperties: {
			oneOf: [
				{ $ref: getSchemaPath(PersistentStringAttributeResponse) },
				{ $ref: getSchemaPath(PersistentBooleanAttributeResponse) },
				{ $ref: getSchemaPath(PersistentIntegerAttributeResponse) },
				{ $ref: getSchemaPath(PersistentDecimalAttributeResponse) },
				{ $ref: getSchemaPath(PersistentBufferAttributeResponse) },
			],
			discriminator: {
				propertyName: "type",
				mapping: {
					[AttributeType.STRING]: getSchemaPath(
						PersistentStringAttributeResponse,
					),
					[AttributeType.BOOLEAN]: getSchemaPath(
						PersistentBooleanAttributeResponse,
					),
					[AttributeType.INTEGER]: getSchemaPath(
						PersistentIntegerAttributeResponse,
					),
					[AttributeType.DECIMAL]: getSchemaPath(
						PersistentDecimalAttributeResponse,
					),
					[AttributeType.BUFFER]: getSchemaPath(
						PersistentBufferAttributeResponse,
					),
				},
			},
		},
	};

	const docsService = app.get(DocsService);
	docsService.setDocument(swaggerDocument);

	if (process.env.UPDATE_OPENAPI) {
		process.exit(0);
	}

	await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
