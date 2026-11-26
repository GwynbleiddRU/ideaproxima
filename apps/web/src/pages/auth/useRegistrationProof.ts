import { useEffect, useRef } from "react";
import type { RegistrationChallenge, RegisterRequest } from "@ideaproxima/contracts";
import { http } from "@/api/http";

type Solution = RegisterRequest["challenge"];

async function prepare(signal: AbortSignal): Promise<Solution> {
  const puzzle = await http.get<RegistrationChallenge | null>("/auth/challenge", undefined, signal);
  signal.throwIfAborted();
  if (!puzzle) return undefined;
  const worker = new Worker(new URL("./pow.worker.ts", import.meta.url), { type: "module" });
  const listeners = new AbortController();
  try {
    const number = await new Promise<number>((resolve, reject) => {
      signal.addEventListener("abort", () => reject(signal.reason), { signal: listeners.signal });
      worker.onerror = () => reject(new Error("Registration worker failed"));
      worker.onmessage = ({ data }: MessageEvent<number | null>) =>
        data === null ? reject(new Error("Registration puzzle failed")) : resolve(data);
      worker.postMessage(puzzle);
    });
    return { ...puzzle, number };
  } finally {
    listeners.abort();
    worker.terminate();
  }
}

export function useRegistrationProof() {
  const controller = useRef<AbortController | null>(null);
  const pending = useRef<Promise<Solution> | null>(null);
  useEffect(() => {
    const lifetime = new AbortController();
    controller.current = lifetime;
    const initial = prepare(lifetime.signal);
    pending.current = initial;
    // A failed prefetch can be retried on submit. Surface a submit-time failure through the mutation.
    void initial.catch(() => {
      if (pending.current === initial) pending.current = null;
    });
    return () => {
      lifetime.abort();
      pending.current = null;
    };
  }, []);

  return async () => {
    const signal = controller.current!.signal;
    const prepared = pending.current;
    pending.current = null;
    if (prepared) {
      const solution = await prepared;
      if (!solution || Date.parse(solution.expiresAt) > Date.now() + 1000) return solution;
    }
    return prepare(signal);
  };
}
