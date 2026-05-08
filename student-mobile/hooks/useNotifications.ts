import { useState, useEffect } from "react";
import { useFinancialStatus } from "./useFinancialStatus";
import { useAnamnesisStatus } from "./useAnamnesisStatus";
import {
  buildStudentBellNotifications,
  type StudentBellNotification,
} from "../lib/studentBellNotifications";

export function useNotifications() {
  const { chargesList, loading: financialLoading } = useFinancialStatus();
  const {
    expiringModels,
    status: anamnesisStatus,
    expiredCount,
    loading: anamnesisLoading,
  } = useAnamnesisStatus();
  const [notifications, setNotifications] = useState<StudentBellNotification[]>(
    [],
  );
  const [hasCritical, setHasCritical] = useState(false);

  useEffect(() => {
    const nextState = buildStudentBellNotifications({
      chargesList,
      expiringModels,
      anamnesisStatus,
      expiredCount,
    });

    setNotifications(nextState.notifications);
    setHasCritical(nextState.hasCritical);
  }, [chargesList, expiringModels, anamnesisStatus, expiredCount]);

  return {
    notifications,
    hasCritical,
    loading: financialLoading || anamnesisLoading,
  };
}
