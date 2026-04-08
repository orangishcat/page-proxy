import { notificationSinkGlobalKey, type NotificationSink } from "./notification-types";

export const getNotificationSink = () => {
  const sink = (globalThis as Record<string, unknown>)[notificationSinkGlobalKey];
  return typeof sink === "function" ? (sink as NotificationSink) : null;
};
