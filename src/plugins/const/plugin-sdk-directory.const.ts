import path from "path";

export const PLUGIN_SDK_DIRECTORY =
	process.env.PLUGIN_SDK_DIRECTORY || path.join(process.cwd(), "sdk");
