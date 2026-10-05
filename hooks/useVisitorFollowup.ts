import {
  completeVisitorFollowupTask,
  listNewRegistrations,
  listPastorVisitorFollowupAlerts,
  listVisitorFollowupBoard,
  listWelcomeVisitorFollowupTasks,
  markNewRegistrationReviewed,
  type NewRegistrationEntry,
  type VisitorFollowupJourney,
  type VisitorFollowupTask,
} from '@/lib/visitorFollowupApi';
import { useCallback, useEffect, useState } from 'react';

export function useWelcomeVisitorFollowup(isActive: boolean) {
  const [tasks, setTasks] = useState<VisitorFollowupTask[]>([]);
  const [journeys, setJourneys] = useState<VisitorFollowupJourney[]>([]);
  const [newRegistrations, setNewRegistrations] = useState<NewRegistrationEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [completingId, setCompletingId] = useState<string | null>(null);
  const [reviewingId, setReviewingId] = useState<string | null>(null);

  const refetch = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const [nextTasks, nextJourneys, nextRegistrations] = await Promise.all([
        listWelcomeVisitorFollowupTasks(),
        listVisitorFollowupBoard().catch(() => [] as VisitorFollowupJourney[]),
        listNewRegistrations(30).catch(() => [] as NewRegistrationEntry[]),
      ]);
      setTasks(nextTasks);
      setJourneys(nextJourneys);
      setNewRegistrations(nextRegistrations);
    } catch (fetchError) {
      setTasks([]);
      setJourneys([]);
      setNewRegistrations([]);
      setError(
        fetchError instanceof Error
          ? fetchError.message
          : 'Não foi possível carregar as tarefas de acolhimento.'
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!isActive) {
      return;
    }

    void refetch();
  }, [isActive, refetch]);

  const completeTask = useCallback(async (taskId: string) => {
    setCompletingId(taskId);

    try {
      await completeVisitorFollowupTask(taskId);
      await refetch();
      return { success: true as const };
    } catch (completeError) {
      return {
        success: false as const,
        message:
          completeError instanceof Error
            ? completeError.message
            : 'Não foi possível concluir a tarefa.',
      };
    } finally {
      setCompletingId(null);
    }
  }, [refetch]);

  const markRegistrationReviewed = useCallback(async (inboxId: string) => {
    setReviewingId(inboxId);

    try {
      await markNewRegistrationReviewed(inboxId);
      await refetch();
      return { success: true as const };
    } catch (reviewError) {
      return {
        success: false as const,
        message:
          reviewError instanceof Error
            ? reviewError.message
            : 'Não foi possível marcar o cadastro como visto.',
      };
    } finally {
      setReviewingId(null);
    }
  }, [refetch]);

  return {
    tasks,
    journeys,
    newRegistrations,
    loading,
    error,
    completingId,
    reviewingId,
    refetch,
    completeTask,
    markRegistrationReviewed,
  };
}

export function usePastorVisitorFollowup(isActive: boolean) {
  const [alerts, setAlerts] = useState<VisitorFollowupTask[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [completingId, setCompletingId] = useState<string | null>(null);

  const refetch = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      setAlerts(await listPastorVisitorFollowupAlerts());
    } catch (fetchError) {
      setAlerts([]);
      setError(
        fetchError instanceof Error
          ? fetchError.message
          : 'Não foi possível carregar os alertas de acolhimento.'
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!isActive) {
      return;
    }

    void refetch();
  }, [isActive, refetch]);

  const completeTask = useCallback(async (taskId: string) => {
    setCompletingId(taskId);

    try {
      await completeVisitorFollowupTask(taskId);
      await refetch();
      return { success: true as const };
    } catch (completeError) {
      return {
        success: false as const,
        message:
          completeError instanceof Error
            ? completeError.message
            : 'Não foi possível concluir o alerta.',
      };
    } finally {
      setCompletingId(null);
    }
  }, [refetch]);

  return { alerts, loading, error, completingId, refetch, completeTask };
}
