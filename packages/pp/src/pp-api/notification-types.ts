export type NotificationLevel = "log" | "info" | "warn" | "error" | "debug" | "notification";

export const notificationSinkGlobalKey = "__pageProxyNotificationSink__";

export type NotificationSink = (payload: { level: NotificationLevel; values: unknown[] }) => void;
