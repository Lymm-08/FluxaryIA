const authTabIdKey = "fluxary.auth-tab-id";
const presenceChannelPrefix = "fluxary.auth-tab-presence:";
const rememberedTabIdsKey = "fluxary.remembered-auth-tabs";
const probeTimeoutMs = 80;
const tabLeaseDatabase = "fluxary-auth-tab-leases";
const tabLeaseStore = "leases";
const tabLeaseDurationMs = 15_000;
const tabLeaseRefreshMs = 5_000;
const tabIdPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type PresenceMessage =
  | { type: "probe"; requestId: string }
  | { type: "claim"; requestId: string; claimantId: string }
  | { type: "occupied"; requestId: string };

type PresenceChannel = Pick<BroadcastChannel, "addEventListener" | "postMessage" | "close">;
type LockManagerLike = Pick<LockManager, "request">;
type LeaseManagerLike = { tryAcquire(name: string): Promise<(() => void) | null> };

export function createStoragePresenceChannel(
  name: string,
  storage: Pick<Storage, "setItem" | "removeItem"> = window.localStorage,
  eventTarget: Pick<Window, "addEventListener" | "removeEventListener"> = window,
): PresenceChannel {
  const keyPrefix = `${presenceChannelPrefix}${encodeURIComponent(name)}:`;
  const listeners = new Set<(event: MessageEvent<PresenceMessage>) => void>();
  const pendingRemovals = new Map<ReturnType<typeof setTimeout>, string>();
  const onStorage = (event: Event) => {
    const storageEvent = event as StorageEvent;
    if (!storageEvent.key?.startsWith(keyPrefix) || !storageEvent.newValue) return;
    let data: PresenceMessage;
    try {
      data = JSON.parse(storageEvent.newValue) as PresenceMessage;
    } catch {
      return;
    }
    listeners.forEach((listener) => listener({ data } as MessageEvent<PresenceMessage>));
  };
  eventTarget.addEventListener("storage", onStorage);

  return {
    addEventListener(_type: string, listener: EventListener) {
      listeners.add(listener as (event: MessageEvent<PresenceMessage>) => void);
    },
    postMessage(data) {
      const key = `${keyPrefix}${createId()}`;
      storage.setItem(key, JSON.stringify(data));
      const timer = setTimeout(() => {
        storage.removeItem(key);
        pendingRemovals.delete(timer);
      }, 1000);
      pendingRemovals.set(timer, key);
    },
    close() {
      eventTarget.removeEventListener("storage", onStorage);
      pendingRemovals.forEach((key, timer) => {
        clearTimeout(timer);
        storage.removeItem(key);
      });
      pendingRemovals.clear();
      listeners.clear();
    },
  };
}

function createPresenceChannel(name: string): PresenceChannel {
  if (typeof BroadcastChannel !== "undefined") return new BroadcastChannel(name);
  return createStoragePresenceChannel(name);
}

export async function initializeAuthTabId({
  tabStorage = window.sessionStorage,
  persistentStorage = window.localStorage,
  authTokenPrefix,
  createChannel = createPresenceChannel,
  lifecycleTarget = window,
  locks = typeof navigator === "undefined" ? undefined : navigator.locks,
  leaseManager = createIndexedDbLeaseManager(),
  timeoutMs = probeTimeoutMs,
}: {
  tabStorage?: Pick<Storage, "getItem" | "setItem">;
  persistentStorage?: Pick<Storage, "getItem" | "setItem" | "removeItem" | "length" | "key">;
  authTokenPrefix: string;
  createChannel?: (name: string) => PresenceChannel;
  lifecycleTarget?: Pick<Window, "addEventListener">;
  locks?: LockManagerLike | null;
  leaseManager?: LeaseManagerLike | null;
  timeoutMs?: number;
}) {
  const acquireTabIdentity = (tabId: string) => locks
    ? tryAcquireTabLock(tabId, locks)
    : leaseManager?.tryAcquire(`fluxary-auth-tab:${tabId}`) ?? Promise.resolve(null);

  const initialize = async () => {
    const storedTabId = tabStorage.getItem(authTabIdKey);
    let tabId: string | null = null;
    let releaseTabLock: (() => void) | null = null;

    if (storedTabId && tabIdPattern.test(storedTabId)) {
      if (locks || leaseManager) {
        releaseTabLock = await acquireTabIdentity(storedTabId);
        if (releaseTabLock) tabId = storedTabId;
      } else if (!await isTabActive(storedTabId, createChannel, timeoutMs)) {
        tabId = storedTabId;
      }
    } else {
      const candidates = getRememberedTabIds(persistentStorage, authTokenPrefix);
      for (const candidate of candidates) {
        if (locks || leaseManager) {
          releaseTabLock = await acquireTabIdentity(candidate);
          if (releaseTabLock) tabId = candidate;
        } else if (await claimRememberedTab(candidate, createChannel, timeoutMs)) {
          tabId = candidate;
        }
        if (tabId) break;
      }
    }

    if (!tabId) {
      do {
        tabId = createId();
        if (locks || leaseManager) releaseTabLock = await acquireTabIdentity(tabId);
      } while ((locks || leaseManager) && !releaseTabLock);
    }
    tabStorage.setItem(authTabIdKey, tabId);
    if (releaseTabLock) {
      lifecycleTarget.addEventListener("pagehide", (event) => {
        if (!(event as PageTransitionEvent).persisted) releaseTabLock?.();
      });
    }
    keepTabPresence(tabId, createChannel, lifecycleTarget);
    return tabId;
  };

  if (locks) {
    return locks.request("fluxary-auth-tab-identity", { mode: "exclusive" }, initialize);
  }
  return initialize();
}

function createIndexedDbLeaseManager(factory: IDBFactory | undefined = globalThis.indexedDB): LeaseManagerLike | null {
  if (!factory) return null;
  let databasePromise: Promise<IDBDatabase> | null = null;
  const getDatabase = () => {
    if (!databasePromise) {
      databasePromise = new Promise((resolve, reject) => {
        const request = factory.open(tabLeaseDatabase, 1);
        request.onupgradeneeded = () => {
          const database = request.result;
          if (!database.objectStoreNames.contains(tabLeaseStore)) database.createObjectStore(tabLeaseStore);
        };
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error ?? new Error("Não foi possível abrir o armazenamento de isolamento das abas."));
        request.onblocked = () => reject(new Error("O armazenamento de isolamento das abas está bloqueado."));
      });
    }
    return databasePromise;
  };

  const transact = async (operation: (store: IDBObjectStore) => void) => {
    const database = await getDatabase();
    return new Promise<void>((resolve, reject) => {
      const transaction = database.transaction(tabLeaseStore, "readwrite");
      operation(transaction.objectStore(tabLeaseStore));
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error ?? new Error("Falha ao atualizar o isolamento das abas."));
      transaction.onabort = () => reject(transaction.error ?? new Error("A atualização do isolamento das abas foi cancelada."));
    });
  };

  return {
    async tryAcquire(name) {
      const database = await getDatabase();
      const ownerId = createId();
      const transaction = database.transaction(tabLeaseStore, "readwrite");
      const store = transaction.objectStore(tabLeaseStore);
      const request = store.get(name);
      let acquired = false;
      let settled = false;
      const result = new Promise<(() => void) | null>((resolve, reject) => {
        request.onsuccess = () => {
          const lease = request.result as { ownerId?: string; expiresAt?: number } | undefined;
          if (lease && typeof lease.expiresAt === "number" && lease.expiresAt > Date.now()) {
            settled = true;
            resolve(null);
            return;
          }
          acquired = true;
          store.put({ ownerId, expiresAt: Date.now() + tabLeaseDurationMs }, name);
        };
        request.onerror = () => {
          settled = true;
          reject(request.error ?? new Error("Não foi possível verificar o isolamento das abas."));
        };
        transaction.oncomplete = () => {
          if (settled || !acquired) return;
          settled = true;
          let released = false;
          const refresh = () => transact((currentStore) => {
            const currentRequest = currentStore.get(name);
            currentRequest.onsuccess = () => {
              const currentLease = currentRequest.result as { ownerId?: string } | undefined;
              if (currentLease?.ownerId === ownerId) {
                currentStore.put({ ownerId, expiresAt: Date.now() + tabLeaseDurationMs }, name);
              }
            };
          });
          const refreshTimer = setInterval(() => {
            if (!released) void refresh().catch((error: unknown) => {
              console.error("Não foi possível renovar o isolamento da sessão desta aba.", error);
            });
          }, tabLeaseRefreshMs);
          const release = () => {
            if (released) return;
            released = true;
            clearInterval(refreshTimer);
            void transact((currentStore) => {
              const currentRequest = currentStore.get(name);
              currentRequest.onsuccess = () => {
                const currentLease = currentRequest.result as { ownerId?: string } | undefined;
                if (currentLease?.ownerId === ownerId) currentStore.delete(name);
              };
            }).catch((error: unknown) => {
              console.error("Não foi possível liberar o isolamento da sessão desta aba.", error);
            });
          };
          resolve(release);
        };
        transaction.onabort = () => {
          if (settled) return;
          settled = true;
          reject(transaction.error ?? new Error("A aquisição do isolamento das abas foi cancelada."));
        };
        transaction.onerror = () => {
          if (settled) return;
          settled = true;
          reject(transaction.error ?? new Error("Falha ao adquirir o isolamento das abas."));
        };
      });
      return result;
    },
  };
}

function tryAcquireTabLock(tabId: string, locks: LockManagerLike) {
  let resolveAcquired!: (release: (() => void) | null) => void;
  let rejectAcquired!: (reason: unknown) => void;
  let callbackStarted = false;
  let releaseLock!: () => void;
  const holdLock = new Promise<void>((resolve) => {
    releaseLock = resolve;
  });
  const acquired = new Promise<(() => void) | null>((resolve, reject) => {
    resolveAcquired = resolve;
    rejectAcquired = reject;
  });
  const request = locks.request(
    `fluxary-auth-tab:${tabId}`,
    { mode: "exclusive", ifAvailable: true },
    async (lock) => {
      callbackStarted = true;
      if (!lock) {
        resolveAcquired(null);
        return;
      }
      resolveAcquired(releaseLock);
      await holdLock;
    },
  );
  void request.catch((reason: unknown) => {
    if (!callbackStarted) rejectAcquired(reason);
    else console.error("Não foi possível manter o isolamento da sessão desta aba.", reason);
  });
  return acquired;
}

export function rememberAuthTab(
  tabId: string,
  storage: Pick<Storage, "getItem" | "setItem"> = window.localStorage,
) {
  const rememberedIds = readRememberedIds(storage);
  storage.setItem(rememberedTabIdsKey, JSON.stringify([...rememberedIds.filter((id) => id !== tabId), tabId]));
}

export function forgetRememberedAuthTab(
  tabId: string,
  storage: Pick<Storage, "getItem" | "setItem" | "removeItem"> = window.localStorage,
) {
  const rememberedIds = readRememberedIds(storage).filter((id) => id !== tabId);
  if (rememberedIds.length) storage.setItem(rememberedTabIdsKey, JSON.stringify(rememberedIds));
  else storage.removeItem(rememberedTabIdsKey);
}

function getRememberedTabIds(
  storage: Pick<Storage, "getItem" | "length" | "key" | "setItem">,
  authTokenPrefix: string,
) {
  const rememberedIds = readRememberedIds(storage);
  const discoveredIds = Array.from({ length: storage.length }, (_, index) => storage.key(index))
    .map((key) => key?.startsWith(authTokenPrefix) ? key.slice(authTokenPrefix.length) : "")
    .filter((id) => tabIdPattern.test(id));
  const combinedIds = [...new Set([...rememberedIds, ...discoveredIds])];
  if (combinedIds.length !== rememberedIds.length) {
    storage.setItem(rememberedTabIdsKey, JSON.stringify(combinedIds));
  }
  return combinedIds.reverse();
}

function readRememberedIds(storage: Pick<Storage, "getItem">) {
  const value = storage.getItem(rememberedTabIdsKey);
  if (!value) return [];
  try {
    const parsed: unknown = JSON.parse(value);
    return Array.isArray(parsed)
      ? [...new Set(parsed.filter((id): id is string => typeof id === "string" && tabIdPattern.test(id)))]
      : [];
  } catch {
    return [];
  }
}

async function isTabActive(
  tabId: string,
  createChannel: (name: string) => PresenceChannel,
  timeoutMs: number,
) {
  const channel = createChannel(`${presenceChannelPrefix}${tabId}`);
  let active = false;
  const requestId = createId();
  channel.addEventListener("message", (event: MessageEvent<PresenceMessage>) => {
    if (event.data.type === "probe") {
      channel.postMessage({ type: "occupied", requestId: event.data.requestId });
    } else if (event.data.requestId === requestId) {
      active = true;
    }
  });
  channel.postMessage({ type: "probe", requestId });
  await new Promise((resolve) => setTimeout(resolve, timeoutMs));
  channel.close();
  return active;
}

async function claimRememberedTab(
  tabId: string,
  createChannel: (name: string) => PresenceChannel,
  timeoutMs: number,
) {
  const channel = createChannel(`${presenceChannelPrefix}${tabId}`);
  const requestId = createId();
  const contenders = new Set<string>([requestId]);
  let active = false;
  channel.addEventListener("message", (event: MessageEvent<PresenceMessage>) => {
    if (event.data.type === "occupied" && event.data.requestId === requestId) {
      active = true;
    } else if (event.data.type === "claim") {
      contenders.add(event.data.claimantId);
    }
  });
  await new Promise((resolve) => setTimeout(resolve, 0));
  channel.postMessage({ type: "probe", requestId });
  channel.postMessage({ type: "claim", requestId, claimantId: requestId });
  await new Promise((resolve) => setTimeout(resolve, timeoutMs));
  channel.close();
  return !active && [...contenders].sort()[0] === requestId;
}

function keepTabPresence(
  tabId: string,
  createChannel: (name: string) => PresenceChannel,
  lifecycleTarget: Pick<Window, "addEventListener">,
) {
  let channel: PresenceChannel | null = null;
  const open = () => {
    channel = createChannel(`${presenceChannelPrefix}${tabId}`);
    channel.addEventListener("message", (event: MessageEvent<PresenceMessage>) => {
      if (event.data.type === "probe" || event.data.type === "claim") {
        channel?.postMessage({ type: "occupied", requestId: event.data.requestId });
      }
    });
  };
  open();

  lifecycleTarget.addEventListener("pagehide", (event) => {
    if ((event as PageTransitionEvent).persisted) return;
    channel?.close();
    channel = null;
  });
  lifecycleTarget.addEventListener("pageshow", () => {
    if (!channel) open();
  });
}

function createId() {
  return crypto.randomUUID();
}
