"use client";

import { useEffect, useState } from "react";
import {
  computeSavedPlanFreshness,
  createSavedPlan,
  deleteSavedPlan,
  listSavedPlans,
  updateSavedPlan,
  type CreateSavedPlanParams,
  type UpdateSavedPlanParams,
} from "@/lib/savedPlans";
import type { SavedPlanFreshness, SavedPlanRecord } from "@/lib/types";

export function useSavedPlans() {
  const [plans, setPlans] = useState<SavedPlanRecord[]>([]);
  const [storageError, setStorageError] = useState<string | null>(null);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const loadedPlans = listSavedPlans();
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPlans(loadedPlans);
    setHydrated(true);
  }, []);

  const createPlanRecord = (params: CreateSavedPlanParams) => {
    const result = createSavedPlan(params);
    if (!result.ok) {
      setStorageError(result.error || "Could not save this plan.");
      return result;
    }
    setStorageError(null);
    setPlans(result.plans);
    return result;
  };

  const updatePlanRecord = (planId: string, params: UpdateSavedPlanParams) => {
    const result = updateSavedPlan(planId, params);
    if (!result.ok) {
      setStorageError(result.error || "Could not update this plan.");
      return result;
    }
    setStorageError(null);
    setPlans(result.plans);
    return result;
  };

  const deletePlanRecord = (planId: string) => {
    const result = deleteSavedPlan(planId);
    if (!result.ok) {
      setStorageError(result.error || "Could not delete this plan.");
      return result;
    }
    setStorageError(null);
    setPlans(result.plans);
    return result;
  };

  const loadPlan = (planId: string): SavedPlanRecord | null =>
    plans.find((plan) => plan.id === planId) ?? null;

  const getFreshness = (plan: SavedPlanRecord): SavedPlanFreshness =>
    computeSavedPlanFreshness(plan);

  return {
    hydrated,
    plans,
    storageError,
    createPlan: createPlanRecord,
    updatePlan: updatePlanRecord,
    deletePlan: deletePlanRecord,
    loadPlan,
    getFreshness,
  };
}
