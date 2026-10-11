'use client';

import { useRouter } from 'next/navigation';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { api, call, type ApiUser } from '@/lib/api';
import type { ApiWedding } from '@/features/weddings/wedding-form-model';

export type WorkspaceState =
  | { status: 'loading' }
  | { status: 'error' }
  | { status: 'ready'; user: ApiUser; wedding: ApiWedding | null };

/** A one-off message for the next page view, e.g. after creating the wedding or deleting. */
export type WorkspaceNotice = 'wedding-created' | 'event-deleted' | 'guest-deleted' | null;

interface WorkspaceContextValue {
  state: WorkspaceState;
  reload: () => void;
  /** Replaces the wedding after it is created or saved. */
  setWedding: (wedding: ApiWedding) => void;
  notice: WorkspaceNotice;
  setNotice: (notice: WorkspaceNotice) => void;
  signOut: () => Promise<void>;
  signingOut: boolean;
}

const WorkspaceContext = createContext<WorkspaceContextValue | null>(null);

export const SESSION_ENDED_PATH = '/login?session=ended';

/**
 * Loads the signed-in user and their wedding once for every workspace page (decision
 * 0016). A session that cannot be refreshed goes to sign-in, as in decision 0015.
 */
export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [state, setState] = useState<WorkspaceState>({ status: 'loading' });
  const [notice, setNotice] = useState<WorkspaceNotice>(null);
  const [signingOut, setSigningOut] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let active = true;
    void Promise.all([
      call(() => api.GET('/api/v1/me')),
      call(() => api.GET('/api/v1/weddings')),
    ]).then(([me, weddings]) => {
      if (!active) return;
      if (me.error?.status === 401 || weddings.error?.status === 401) {
        router.replace(SESSION_ENDED_PATH);
      } else if (me.data && weddings.data) {
        // A user owns at most one wedding (decision 0012); it is the one shown.
        setState({ status: 'ready', user: me.data.user, wedding: weddings.data[0] ?? null });
      } else {
        setState({ status: 'error' });
      }
    });
    return () => {
      active = false;
    };
  }, [router, attempt]);

  const reload = useCallback(() => {
    setState({ status: 'loading' });
    setAttempt((value) => value + 1);
  }, []);

  const setWedding = useCallback((wedding: ApiWedding) => {
    setState((current) => (current.status === 'ready' ? { ...current, wedding } : current));
  }, []);

  const signOut = useCallback(async () => {
    setSigningOut(true);
    await call(() => api.POST('/api/v1/auth/logout'));
    router.replace('/login');
  }, [router]);

  const value = useMemo(
    () => ({ state, reload, setWedding, notice, setNotice, signOut, signingOut }),
    [state, reload, setWedding, notice, signOut, signingOut],
  );
  return <WorkspaceContext.Provider value={value}>{children}</WorkspaceContext.Provider>;
}

export function useWorkspace(): WorkspaceContextValue {
  const context = useContext(WorkspaceContext);
  if (!context) throw new Error('useWorkspace must be used inside WorkspaceProvider');
  return context;
}

/**
 * The loaded workspace, for pages: the shell renders pages only once loading succeeded.
 */
export function useReadyWorkspace() {
  const context = useWorkspace();
  if (context.state.status !== 'ready') {
    throw new Error('useReadyWorkspace used before the workspace finished loading');
  }
  return { ...context, user: context.state.user, wedding: context.state.wedding };
}
