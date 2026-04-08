import { showPageNotification } from "./notification-host";
import { forwardNotificationLog } from "./notification-log";
import { getNotificationSink } from "./notification-sink";
export { notificationSinkGlobalKey } from "./notification-types";
export type { NotificationLevel } from "./notification-types";

export const notification = (...values: unknown[]) => {
  forwardNotificationLog(...values);
  showPageNotification(values);
  const sink = getNotificationSink();
  if (!sink) {
    return;
  }
  sink({
    level: "notification",
    values,
  });
};
