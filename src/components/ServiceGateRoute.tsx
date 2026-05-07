import { useEffect, type ReactNode } from "react";
import { useLocation } from "react-router-dom";
import { useServiceGate, type ServiceId } from "@/hooks/useServiceGate";

type ServiceGateRouteProps = {
  service: ServiceId;
  children: ReactNode;
};

const ServiceGateRoute = ({ service, children }: ServiceGateRouteProps) => {
  const location = useLocation();
  const { readiness, isLoading, canUseService } = useServiceGate();
  const returnTo = `${location.pathname}${location.search}`;
  const serviceReadiness = readiness?.services?.[service];
  const isBlocked = !!serviceReadiness && !serviceReadiness.ready;

  useEffect(() => {
    if (!isLoading && readiness) {
      canUseService(service, returnTo);
    }
  }, [canUseService, isLoading, readiness, returnTo, service]);

  if (isLoading || isBlocked) {
    return null;
  }

  return <>{children}</>;
};

export default ServiceGateRoute;
