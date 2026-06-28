export interface AuthClient {
	getUsername(userUuid: string): Promise<string | null>;
	getUuid(username: string): Promise<string | null>;
	generateUserToken(userUuid: string): Promise<string>;
	getUserFromToken(token: string): Promise<string | null>;
}
