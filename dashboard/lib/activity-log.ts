"use client";

import { useSyncExternalStore } from "react";

// Session-local record of things that happened in THIS browser while using
// the app — specifically duplicate-rejection events, which the backend
// never persists (a rejected mint never becomes a database row, so there's
// nothing to fetch it back from). Minted/retired events are derived from
// real certificate data instead (see useActivityFeed); this only fills the
// one gap that real data can't cover.
export type ActivityEvent = {
  id: string;
  type: "minted" | "retired" | "duplicate_rejected";
  tokenId?: number;
  plantId?: string;
  message: string;
  timestamp: string;
};

const STORAGE_KEY = "recon:activity-log";
let events: ActivityEvent[] = [];
const listeners = new Set<() => void>();

function load() {
  if (typeof window === "undefined") return;
  try {
    events = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "[]");
  } catch {
    events = [];
  }
}
load();

function persist() {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(events.slice(0, 50)));
  } catch {
    // storage unavailable (private mode etc.) — feed just won't persist
  }
}

export function logActivity(event: Omit<ActivityEvent, "id" | "timestamp">) {
  events = [{ ...event, id: `${Date.now()}-${Math.random().toString(36).slice(2)}`, timestamp: new Date().toISOString() }, ...events].slice(0, 50);
  persist();
  listeners.forEach((l) => l());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function getSnapshot() {
  return events;
}

function getServerSnapshot(): ActivityEvent[] {
  return [];
}

export function useLocalActivityLog() {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
