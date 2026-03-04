import { createElement, type ReactElement } from "react";
import { render } from "@testing-library/react";

import { AppProvider } from "../../frontend/src/context/AppContext";
import { initialState } from "../../frontend/src/context/AppReducer";
import type { AppState } from "../../frontend/src/lib/types";

export function makeAppState(overrides: Partial<AppState> = {}): AppState {
  return {
    ...initialState,
    ...overrides,
    courses: overrides.courses ?? initialState.courses,
    programs: overrides.programs ?? initialState.programs,
    completed: overrides.completed ?? new Set<string>(),
    inProgress: overrides.inProgress ?? new Set<string>(),
    selectedMajors: overrides.selectedMajors ?? new Set<string>(),
    selectedTracks: overrides.selectedTracks ?? [],
    selectedMinors: overrides.selectedMinors ?? new Set<string>(),
    lastRecommendationData: overrides.lastRecommendationData ?? null,
  };
}

export function renderWithApp(ui: ReactElement, state: AppState) {
  return render(createElement(AppProvider, { initialStateValue: state }, ui));
}
