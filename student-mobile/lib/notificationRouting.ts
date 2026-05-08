import * as Notifications from "expo-notifications";
import { router } from "expo-router";
import { handleTrainingNotificationResponse } from "./trainingNotificationActions";
import {
  isStudentBellPushData,
  type StudentBellNotification,
  type StudentBellPushData,
} from "./studentBellNotifications";

export function navigateToStudentBellNotification(
  notification: Pick<StudentBellNotification, "route">,
): void {
  router.push(notification.route);
}

export async function handleAppNotificationResponse(
  response: Notifications.NotificationResponse,
): Promise<void> {
  const data = response.notification.request.content.data;
  if (isStudentBellPushData(data)) {
    navigateToStudentBellPushData(data);
    return;
  }

  await handleTrainingNotificationResponse(response);
}

export function getNotificationResponseKey(
  response: Notifications.NotificationResponse,
): string {
  const data = response.notification.request.content
    .data as Record<string, unknown> | null;
  const candidateKey = data?.dedupeKey;

  if (typeof candidateKey === "string" && candidateKey.length > 0) {
    return `${response.actionIdentifier}:${candidateKey}`;
  }

  return `${response.actionIdentifier}:${response.notification.request.identifier}`;
}

function navigateToStudentBellPushData(data: StudentBellPushData): void {
  router.push(data.route);
}
