import {
  useGetVoterSession,
  useGetAdminSession,
  getGetVoterSessionQueryOptions,
  getGetAdminSessionQueryOptions,
} from "@workspace/api-client-react";
import { useLocation } from "wouter";
import { useEffect } from "react";

export function useVoterSession(redirectIfUnauthenticated = true) {
  const [, setLocation] = useLocation();
  const query = useGetVoterSession({
    query: { ...getGetVoterSessionQueryOptions(), retry: false },
  });

  useEffect(() => {
    if (redirectIfUnauthenticated && query.isError) {
      setLocation("/login");
    }
  }, [query.isError, redirectIfUnauthenticated, setLocation]);

  return query;
}

export function useAdminSession(redirectIfUnauthenticated = true) {
  const [, setLocation] = useLocation();
  const query = useGetAdminSession({
    query: { ...getGetAdminSessionQueryOptions(), retry: false },
  });

  useEffect(() => {
    if (redirectIfUnauthenticated && query.isError) {
      setLocation("/admin/login");
    }
  }, [query.isError, redirectIfUnauthenticated, setLocation]);

  return query;
}
