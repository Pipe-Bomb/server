export interface AttributeUploadSession {
	uuid: string;
	userUuid: string;
	resolve: (buffer: Buffer) => void;
	reject: (error: Error) => void;
	extend: () => void;
	timeout: NodeJS.Timeout | null;
}
