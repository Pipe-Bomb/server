import { SetMetadata } from "@nestjs/common";

export const IS_AUTH_OPTIONAL_KEY = "isAuthOptional";
export const OptionalAuth = () => SetMetadata(IS_AUTH_OPTIONAL_KEY, true);
