import { Entity, PrimaryColumn } from "typeorm";
import { IdentifierType } from "../enum/identifier-type.enum";

@Entity("disabled_identifiers")
export class DBDisabledIdentifier {
	@PrimaryColumn({ type: "text" })
	pluginId: string;

	@PrimaryColumn({ type: "text" })
	identifierId: string;

	@PrimaryColumn({ type: "text" })
	type: IdentifierType;
}
