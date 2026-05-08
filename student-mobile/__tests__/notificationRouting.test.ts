jest.mock("../lib/trainingNotificationActions", () => ({
  handleTrainingNotificationResponse: jest.fn(async () => {}),
}));

import { router } from "expo-router";
import { handleAppNotificationResponse } from "../lib/notificationRouting";
import { handleTrainingNotificationResponse } from "../lib/trainingNotificationActions";

describe("notificationRouting", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("routes student bell pushes to the target screen", async () => {
    await handleAppNotificationResponse({
      actionIdentifier: "expo.notifications.actions.DEFAULT",
      notification: {
        request: {
          identifier: "notif-1",
          content: {
            data: {
              notificationKind: "student_bell",
              source: "student_bell",
              id: "fin-1",
              type: "financial",
              title: "Financeiro",
              message: "Sua fatura vence hoje!",
              route: "/financial",
              date: "2026-05-06",
              daysRemaining: 0,
              dedupeKey: "student-bell:financial:2026-05-06:fin-1",
            },
          },
        },
      },
    } as any);

    expect(router.push).toHaveBeenCalledWith("/financial");
    expect(handleTrainingNotificationResponse).not.toHaveBeenCalled();
  });

  it("keeps delegating non-bell notifications to the training handler", async () => {
    await handleAppNotificationResponse({
      actionIdentifier: "pause_training",
      notification: {
        request: {
          identifier: "notif-2",
          content: {
            data: {
              kind: "active_training",
            },
          },
        },
      },
    } as any);

    expect(handleTrainingNotificationResponse).toHaveBeenCalledTimes(1);
  });
});
