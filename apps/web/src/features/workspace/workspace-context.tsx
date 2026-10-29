'use client';

import type { components } from '@makemymarriage/api-client';
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

/** A member's effective permissions in the selected wedding (API Design §7.1). */
export type ApiPermissions = components['schemas']['MemberPermissionsDto'];

export type WorkspaceState =
  | { status: 'loading' }
  | { status: 'error' }
  | {
      status: 'ready';
      user: ApiUser;
      /** The selected wedding, or null when the user belongs to none. */
      wedding: ApiWedding | null;
      /** Every wedding the user is an active member of, in the API's order (0035). */
      weddings: ApiWedding[];
      /** The caller's permissions in the selected wedding; null without one. */
      permissions: ApiPermissions | null;
    };

/** A one-off message for the next page view, e.g. after creating the wedding or deleting. */
export type WorkspaceNotice =
  | 'wedding-created'
  | 'wedding-saved'
  | 'wedding-switched'
  | 'event-saved'
  | 'event-deleted'
  | 'guest-deleted'
  | 'task-deleted'
  | 'expense-saved'
  | 'expense-deleted'
  | 'member-removed'
  | null;

interface WorkspaceContextValue {
  state: WorkspaceState;
  reload: () => void;
  /** Replaces the selected wedding's details after they are saved. */
  setWedding: (wedding: ApiWedding) => void;
  /** Selects a wedding the user just created and reloads, with its permissions. */
  weddingCreated: (wedding: ApiWedding) => void;
  /** Switches the whole workspace to another of the user's weddings (System Design §7.12). */
  selectWedding: (weddingId: string) => void;
  notice: WorkspaceNotice;
  setNotice: (notice: WorkspaceNotice) => void;
  signOut: () => Promise<void>;
  signingOut: boolean;
}

const WorkspaceContext = createContext<WorkspaceContextValue | null>(null);

export const SESSION_ENDED_PATH = '/login?session=ended';

/** The selected wedding is a per-device preference, never trusted by the server (§7.12). */
const selectionKey = (userId: string) => `mmm.selectedWedding.${userId}`;

function rememberedWedding(userId: string): string | null {
  try {
    return window.localStorage.getItem(selectionKey(userId));
  } catch {
    return null;
  }
}

export function rememberWedding(userId: string, weddingId: string): void {
  try {
    window.localStorage.setItem(selectionKey(userId), weddingId);
  } catch {
    // Storage blocked: the selection lasts until the next load.
  }
}

/**
 * Loads the signed-in user, their weddings, the selected wedding and the user's permissions
 * in it, once for every workspace page (decisions 0016, 0035). A remembered selection that
 * is no longer one of the user's weddings is discarded; the first wedding is the default.
 * Switching reloads everything, so nothing from the previous wedding is reused. A session
 * that cannot be refreshed goes to sign-in, as in decision 0015.
 */
export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [state, setState] = useState<WorkspaceState>({ status: 'loading' });
  const [notice, setNotice] = useState<WorkspaceNotice>(null);
  const [signingOut, setSigningOut] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let active = true;
    void (async () => {
      const [me, weddings] = await Promise.all([
        call(() => api.GET('/api/v1/me')),
        call(() => api.GET('/api/v1/weddings')),
      ]);
      if (!active) return;
      if (me.error?.status === 401 || weddings.error?.status === 401) {
        router.replace(SESSION_ENDED_PATH);
        return;
      }
      if (!me.data || !weddings.data) {
        setState({ status: 'error' });
        return;
      }
      const user = me.data.user;
      const remembered = rememberedWedding(user.id);
      const wedding =
        weddings.data.find((candidate) => candidate.id === remembered) ?? weddings.data[0] ?? null;
      let permissions: ApiPermissions | null = null;
      if (wedding) {
        const result = await call(() =>
          api.GET('/api/v1/weddings/{weddingId}/members/me/permissions', {
            params: { path: { weddingId: wedding.id } },
          }),
        );
        if (!active) return;
        if (result.error?.status === 401) {
          router.replace(SESSION_ENDED_PATH);
          return;
        }
        if (!result.data) {
          setState({ status: 'error' });
          return;
        }
        permissions = result.data;
      }
      setState({ status: 'ready', user, wedding, weddings: weddings.data, permissions });
    })();
    return () => {
      active = false;
    };
  }, [router, attempt]);

  const reload = useCallback(() => {
    setState({ status: 'loading' });
    setAttempt((value) => value + 1);
  }, []);

  const setWedding = useCallback((wedding: ApiWedding) => {
    // A save returns the details only: the caller's membership of the wedding is kept.
    const merge = (current: ApiWedding) =>
      current.id === wedding.id
        ? { ...current, ...wedding, membership: current.membership }
        : current;
    setState((current) =>
      current.status === 'ready'
        ? {
            ...current,
            wedding: current.wedding && merge(current.wedding),
            weddings: current.weddings.map(merge),
          }
        : current,
    );
  }, []);

  const weddingCreated = useCallback(
    (wedding: ApiWedding) => {
      if (state.status === 'ready') rememberWedding(state.user.id, wedding.id);
      reload();
    },
    [state, reload],
  );

  const selectWedding = useCallback(
    (weddingId: string) => {
      if (state.status !== 'ready') return;
      rememberWedding(state.user.id, weddingId);
      setNotice('wedding-switched');
      router.push('/dashboard');
      reload();
    },
    [state, router, reload],
  );

  const signOut = useCallback(async () => {
    setSigningOut(true);
    await call(() => api.POST('/api/v1/auth/logout'));
    router.replace('/login');
  }, [router]);

  const value = useMemo(
    () => ({
      state,
      reload,
      setWedding,
      weddingCreated,
      selectWedding,
      notice,
      setNotice,
      signOut,
      signingOut,
    }),
    [state, reload, setWedding, weddingCreated, selectWedding, notice, signOut, signingOut],
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
  return {
    ...context,
    user: context.state.user,
    wedding: context.state.wedding,
    weddings: context.state.weddings,
    permissions: context.state.permissions,
  };
}

/**
 * What the caller may do in the selected wedding, to show or hide controls (API Design §7.1).
 * The server authorizes every request; this never replaces that.
 */
export function usePermissions() {
  const { permissions } = useReadyWorkspace();
  return useMemo(() => {
    const granted = (permissions?.permissions ?? {}) as Record<string, string[] | undefined>;
    return {
      isOwner: permissions?.isOwner ?? false,
      role: permissions?.role ?? null,
      can: (module: string, action: string) => granted[module]?.includes(action) ?? false,
    };
  }, [permissions]);
}
