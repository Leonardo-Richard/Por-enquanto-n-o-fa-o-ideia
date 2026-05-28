"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { AdnExecutionsOverviewResponse } from "@repo/shared";
import { fetchAdnExecutionsOverview } from "@/lib/adn-executions-overview-client";
const POLL_MS = 30_000;

export function useAdnExecutionsOverview(organizationId: string | null | undefined) {
  const [data, setData] = useState<AdnExecutionsOverviewResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const reload = useCallback(async () => {
    if (!organizationId) {
      setData(null);
      setError(null);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetchAdnExecutionsOverview(organizationId);
      setData(res);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao carregar resumo.");
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [organizationId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  useEffect(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
    if (!organizationId || !data) {
      return;
    }
    const inFlight = data.counts.queued + data.counts.running;
    if (inFlight <= 0) {
      return;
    }
    pollRef.current = setInterval(() => {
      void reload();
    }, POLL_MS);
    return () => {
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
    };
  }, [organizationId, data?.counts.queued, data?.counts.running, reload]);

  return { data, loading, error, reload };
}
