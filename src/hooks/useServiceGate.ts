import { useCallback } from "react";
import { useNavigate, type NavigateOptions } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";

export type ServiceId =
  | "medications"
  | "adherenceReport"
  | "medicationReminders"
  | "medicationInteractions"
  | "sos"
  | "doctor"
  | "localServices"
  | "specialistFinder"
  | "reports"
  | "concierge"
  | "symptomCheck"
  | "caregiverDashboard"
  | "socialRooms"
  | "activities"
  | "brainTraining"
  | "chat";

export type MissingSetupStep = {
  section: string;
  path: string;
  reason: string;
};

export type ServiceReadiness = {
  ready: boolean;
  missing: MissingSetupStep[];
  recommended?: MissingSetupStep[];
};

export type ReadinessResponse = {
  profile: Record<string, boolean>;
  services: Record<ServiceId, ServiceReadiness>;
};

function withReturnTo(path: string, returnTo: string): string {
  const separator = path.includes("?") ? "&" : "?";
  return `${path}${separator}returnTo=${encodeURIComponent(returnTo)}`;
}

export function serviceForPath(path: string): ServiceId | null {
  if (path.startsWith("/chat")) return "chat";
  if (path === "/meds") return "medications";
  if (path.startsWith("/meds/adherence-report")) return "adherenceReport";
  if (path.startsWith("/health/doctor")) return "doctor";
  if (path.startsWith("/health/symptom-check")) return "symptomCheck";
  if (path.startsWith("/concierge")) return "concierge";
  if (path.startsWith("/caregiver")) return "caregiverDashboard";
  return null;
}

export function useServiceGate() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const readinessQuery = useQuery<ReadinessResponse>({
    queryKey: ["/api/profile/readiness"],
    staleTime: 30_000,
    retry: false,
  });

  const canUseService = useCallback(
    (serviceId: ServiceId, returnTo: string): boolean => {
      if (!readinessQuery.data) {
        return !readinessQuery.isLoading;
      }

      const service = readinessQuery.data?.services?.[serviceId];

      if (!service || service.ready) return true;

      const firstMissing = service.missing[0];
      if (!firstMissing) return true;

      toast({
        title: firstMissing.section === "subscription" ? "Plan upgrade needed" : "A little setup first",
        description: firstMissing.reason,
      });
      navigate(withReturnTo(firstMissing.path, returnTo));
      return false;
    },
    [navigate, readinessQuery.data, readinessQuery.isLoading, toast],
  );

  const guardPath = useCallback(
    (path: string, options?: NavigateOptions): boolean => {
      const serviceId = serviceForPath(path);

      if (serviceId && !canUseService(serviceId, path)) {
        return false;
      }

      navigate(path, options);
      return true;
    },
    [canUseService, navigate],
  );

  return {
    readiness: readinessQuery.data,
    isLoading: readinessQuery.isLoading,
    canUseService,
    guardPath,
  };
}
