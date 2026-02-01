// src/visualization/state.ts
// Centralized state management for visualization app

import type { AnalysisOutput } from "./types";

interface AppState {
  batchA: AnalysisOutput | null;
  batchB: AnalysisOutput | null;
  fileNameA: string;
  fileNameB: string;
  currentPage: "charts" | "stats";
  isDragging: boolean;
  errorMessage: string | null;
  apiAvailable: boolean;
  availableLogs: string[];
}

const state: AppState = {
  batchA: null,
  batchB: null,
  fileNameA: "",
  fileNameB: "",
  currentPage: "charts",
  isDragging: false,
  errorMessage: null,
  apiAvailable: false,
  availableLogs: [],
};

// Getters
export function getBatchA(): AnalysisOutput | null {
  return state.batchA;
}

export function getBatchB(): AnalysisOutput | null {
  return state.batchB;
}

export function getFileNameA(): string {
  return state.fileNameA;
}

export function getFileNameB(): string {
  return state.fileNameB;
}

export function getCurrentPage(): "charts" | "stats" {
  return state.currentPage;
}

export function isDragging(): boolean {
  return state.isDragging;
}

export function getErrorMessage(): string | null {
  return state.errorMessage;
}

export function isApiAvailable(): boolean {
  return state.apiAvailable;
}

export function getAvailableLogs(): string[] {
  return state.availableLogs;
}

// Setters
export function setBatchA(batch: AnalysisOutput | null): void {
  state.batchA = batch;
}

export function setBatchB(batch: AnalysisOutput | null): void {
  state.batchB = batch;
}

export function setFileNameA(name: string): void {
  state.fileNameA = name;
}

export function setFileNameB(name: string): void {
  state.fileNameB = name;
}

export function setCurrentPage(page: "charts" | "stats"): void {
  state.currentPage = page;
}

export function setDragging(dragging: boolean): void {
  state.isDragging = dragging;
}

export function setErrorMessage(message: string | null): void {
  state.errorMessage = message;
}

export function setApiAvailable(available: boolean): void {
  state.apiAvailable = available;
}

export function setAvailableLogs(logs: string[]): void {
  state.availableLogs = logs;
}

// Compound operations
export function clearBatchA(): void {
  state.batchA = null;
  state.fileNameA = "";
  state.batchB = null;
  state.fileNameB = "";
}

export function clearBatchB(): void {
  state.batchB = null;
  state.fileNameB = "";
}
