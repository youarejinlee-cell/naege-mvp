export const appVariant = process.env.APP_VARIANT || "development";
export const isDevelopmentVariant = appVariant === "development";
export const isProductionVariant = appVariant === "production";
export const canUseDevTools = !isProductionVariant;
