import { reconcile } from '../lib/match';
import type { ReconcileInput } from '../types';

const scope = globalThis as typeof globalThis & {
  onmessage: ((event: MessageEvent<ReconcileInput>) => void) | null;
};

// Runs only inside the worker. The page never posts file bytes anywhere.
if (typeof document === 'undefined' && typeof scope.postMessage === 'function') {
  scope.onmessage = (event: MessageEvent<ReconcileInput>) => {
    const post = scope.postMessage as (message: unknown) => void;
    post(reconcile(event.data));
  };
}

export {};
