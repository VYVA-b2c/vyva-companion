export const APP_VERSION =
  typeof __APP_VERSION__ === "string" && __APP_VERSION__.trim().length > 0
    ? __APP_VERSION__
    : "2.0.0";
