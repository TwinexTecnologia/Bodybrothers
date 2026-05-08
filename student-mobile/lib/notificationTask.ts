import * as Notifications from "expo-notifications";
import * as TaskManager from "expo-task-manager";
import { isStudentBellPushData } from "./studentBellNotifications";
import { handleTrainingNotificationResponse } from "./trainingNotificationActions";

export const TRAINING_NOTIFICATION_TASK = "TRAINING_NOTIFICATION_RESPONSE_TASK";

TaskManager.defineTask(TRAINING_NOTIFICATION_TASK, async ({ data, error }) => {
  if (error) return;
  if (data == null) return;
  if (typeof data === "object" && data !== null && "actionIdentifier" in data) {
    const response = data as Notifications.NotificationResponse;
    const contentData = response.notification.request.content.data;
    if (isStudentBellPushData(contentData)) {
      return;
    }

    await handleTrainingNotificationResponse(response);
  }
});

export async function registerTrainingNotificationBackgroundTask(): Promise<void> {
  await Notifications.registerTaskAsync(TRAINING_NOTIFICATION_TASK);
}
