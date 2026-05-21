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

async function bootstrap() {
	try {
		await rm("temp", {
			recursive: true,
		});
	} catch {}
	await mkdir("temp");

	const app = await NestFactory.create<NestExpressApplication>(AppModule);
	app.enableCors({
		origin: "http://127.0.0.1:3001",
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
		.build();

	// mkdirSync("openapi", { recursive: true });
	const swaggerDocument = SwaggerModule.createDocument(app, swaggerConfig, {
		operationIdFactory: (_controllerKey, methodKey) => methodKey,
	});

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
