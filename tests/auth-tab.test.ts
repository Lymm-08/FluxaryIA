import { beforeEach, describe, expect, it } from "vitest";
import { createStoragePresenceChannel, initializeAuthTabId, rememberAuthTab } from "../src/lib/auth-tab";

type ChannelMessage =
  | { type: "probe" | "occupied"; requestId: string }
  | { type: "claim"; requestId: string; claimantId: string };
type MessageListener = (event: MessageEvent<ChannelMessage>) => void;

const channels = new Map<string, FakeChannel[]>();
let fakeLocks: FakeLockManager;

class FakeChannel {
  private listeners: MessageListener[] = [];
  closed = false;

  constructor(private readonly name: string) {
    channels.set(name, [...(channels.get(name) ?? []), this]);
  }

  addEventListener(_type: "message", listener: MessageListener) {
    this.listeners.push(listener);
  }

  postMessage(data: ChannelMessage) {
    for (const channel of channels.get(this.name) ?? []) {
      if (channel === this || channel.closed) continue;
      queueMicrotask(() => channel.listeners.forEach((listener) => listener({ data } as MessageEvent<ChannelMessage>)));
    }
  }

  close() {
    this.closed = true;
  }
}

class MemoryStorage {
  private readonly values: Map<string, string>;

  constructor(values: Map<string, string> = new Map()) {
    this.values = new Map(values);
  }

  getItem(key: string) {
    return this.values.get(key) ?? null;
  }

  setItem(key: string, value: string) {
    this.values.set(key, value);
  }

  removeItem(key: string) {
    this.values.delete(key);
  }

  get length() {
    return this.values.size;
  }

  key(index: number) {
    return Array.from(this.values.keys())[index] ?? null;
  }

  clone() {
    return new MemoryStorage(this.values);
  }
}

class SharedStorageBus {
  private readonly values = new Map<string, string>();
  private readonly contexts = new Set<StorageContext>();

  createContext() {
    const context = new StorageContext(this);
    this.contexts.add(context);
    return context;
  }

  getItem(key: string) {
    return this.values.get(key) ?? null;
  }

  get size() {
    return this.values.size;
  }

  setItem(source: StorageContext, key: string, value: string) {
    const oldValue = this.values.get(key) ?? null;
    this.values.set(key, value);
    this.broadcast(source, key, oldValue, value);
  }

  removeItem(source: StorageContext, key: string) {
    const oldValue = this.values.get(key) ?? null;
    this.values.delete(key);
    this.broadcast(source, key, oldValue, null);
  }

  private broadcast(source: StorageContext, key: string, oldValue: string | null, newValue: string | null) {
    for (const context of this.contexts) {
      if (context === source) continue;
      context.dispatch(new StorageEvent("storage", { key, oldValue, newValue }));
    }
  }
}

class StorageContext {
  private listeners: EventListener[] = [];

  constructor(private readonly bus: SharedStorageBus) {}

  readonly storage = {
    getItem: (key: string) => this.bus.getItem(key),
    setItem: (key: string, value: string) => this.bus.setItem(this, key, value),
    removeItem: (key: string) => this.bus.removeItem(this, key),
  };

  addEventListener(_type: string, listener: EventListener) {
    this.listeners.push(listener);
  }

  removeEventListener(_type: string, listener: EventListener) {
    this.listeners = this.listeners.filter((candidate) => candidate !== listener);
  }

  dispatch(event: Event) {
    this.listeners.forEach((listener) => listener(event));
  }
}

class FakeLockManager {
  private readonly held = new Map<string, Promise<unknown>>();

  request<T>(
    name: string,
    _options: { mode: "exclusive"; ifAvailable?: boolean },
    callback: (lock: Lock | null) => Promise<T> | T,
  ) {
    if (this.held.has(name)) return Promise.resolve(callback(null));
    const request = Promise.resolve(callback({} as Lock));
    this.held.set(name, request);
    return request
      .finally(() => {
        if (this.held.get(name) === request) this.held.delete(name);
      });
  }

  has(name: string) {
    return this.held.has(name);
  }
}

fakeLocks = new FakeLockManager();

function initializeOptions(
  tabStorage: MemoryStorage,
  persistentStorage: MemoryStorage,
  lifecycle = lifecycleTarget(),
  createChannel = (name: string) => new FakeChannel(name),
  locks: FakeLockManager | null = fakeLocks,
  leaseManager: { tryAcquire(name: string): Promise<(() => void) | null> } | null = null,
) {
  return {
    tabStorage,
    persistentStorage,
    authTokenPrefix: "sb-project-auth-token-",
    createChannel,
    lifecycleTarget: lifecycle,
    locks,
    leaseManager,
    timeoutMs: 1,
  };
}

beforeEach(() => {
  channels.clear();
});

function lifecycleTarget() {
  const listeners = new Map<string, ((event: Event) => void)[]>();
  return {
    addEventListener(type: string, listener: EventListenerOrEventListenerObject) {
      const callback = typeof listener === "function"
        ? listener as (event: Event) => void
        : (event: Event) => listener.handleEvent(event);
      listeners.set(type, [...(listeners.get(type) ?? []), callback]);
    },
    dispatch(type: string) {
      const event = new Event(type);
      listeners.get(type)?.forEach((listener) => listener(event));
    },
  };
}

describe("identidade da sessão por aba", () => {
  it("mantém o identificador após recarga e separa uma aba duplicada", async () => {
    const sourceStorage = new MemoryStorage();
    const sourceLifecycle = lifecycleTarget();
    const persistentStorage = new MemoryStorage();
    const sourceId = await initializeAuthTabId(initializeOptions(sourceStorage, persistentStorage, sourceLifecycle));
    expect(fakeLocks.has(`fluxary-auth-tab:${sourceId}`)).toBe(true);

    const duplicateStorage = sourceStorage.clone();
    const duplicateId = await initializeAuthTabId(initializeOptions(duplicateStorage, persistentStorage));

    expect(duplicateId).not.toBe(sourceId);
    expect(duplicateStorage.getItem("fluxary.auth-tab-id")).toBe(duplicateId);

    sourceLifecycle.dispatch("pagehide");
    await new Promise((resolve) => setTimeout(resolve, 0));
    const reloadId = await initializeAuthTabId(initializeOptions(sourceStorage, persistentStorage));
    expect(reloadId).toBe(sourceId);
  });

  it("atribui identificadores independentes a abas abertas normalmente", async () => {
    const persistentStorage = new MemoryStorage();
    const firstTabId = await initializeAuthTabId(initializeOptions(new MemoryStorage(), persistentStorage));
    const secondTabId = await initializeAuthTabId(initializeOptions(new MemoryStorage(), persistentStorage));
    const thirdTabId = await initializeAuthTabId(initializeOptions(new MemoryStorage(), persistentStorage));

    expect(secondTabId).not.toBe(firstTabId);
    expect(thirdTabId).not.toBe(firstTabId);
    expect(thirdTabId).not.toBe(secondTabId);
  });

  it("recupera a sessão lembrada quando uma nova aba é aberta após fechar a anterior", async () => {
    const persistentStorage = new MemoryStorage();
    const oldTabStorage = new MemoryStorage();
    const oldTabLifecycle = lifecycleTarget();
    const oldTabId = await initializeAuthTabId(initializeOptions(oldTabStorage, persistentStorage, oldTabLifecycle));
    const tokenKey = `sb-project-auth-token-${oldTabId}`;
    persistentStorage.setItem(tokenKey, "opaque-session");
    rememberAuthTab(oldTabId, persistentStorage);
    oldTabLifecycle.dispatch("pagehide");
    await new Promise((resolve) => setTimeout(resolve, 0));

    const newTabId = await initializeAuthTabId(initializeOptions(new MemoryStorage(), persistentStorage));

    expect(newTabId).toBe(oldTabId);
    expect(persistentStorage.getItem(tokenKey)).toBe("opaque-session");
  });

  it("reatribui sessões lembradas fechadas sem reutilizar as de abas ativas", async () => {
    const persistentStorage = new MemoryStorage();
    const olderId = "22222222-2222-4222-8222-222222222222";
    const newerId = "33333333-3333-4333-8333-333333333333";
    persistentStorage.setItem(`sb-project-auth-token-${olderId}`, "opaque-session-a");
    persistentStorage.setItem(`sb-project-auth-token-${newerId}`, "opaque-session-b");
    rememberAuthTab(olderId, persistentStorage);
    rememberAuthTab(newerId, persistentStorage);

    const firstNewTab = await initializeAuthTabId(initializeOptions(new MemoryStorage(), persistentStorage));
    const secondNewTab = await initializeAuthTabId(initializeOptions(new MemoryStorage(), persistentStorage));

    expect(firstNewTab).toBe(newerId);
    expect(secondNewTab).toBe(olderId);
  });

  it("não reutiliza uma sessão lembrada enquanto a aba original continua ativa", async () => {
    const persistentStorage = new MemoryStorage();
    const originalLifecycle = lifecycleTarget();
    const originalId = await initializeAuthTabId(initializeOptions(
      new MemoryStorage(),
      persistentStorage,
      originalLifecycle,
    ));
    expect(fakeLocks.has(`fluxary-auth-tab:${originalId}`)).toBe(true);
    persistentStorage.setItem(`sb-project-auth-token-${originalId}`, "opaque-session");
    rememberAuthTab(originalId, persistentStorage);

    const concurrentId = await initializeAuthTabId(initializeOptions(new MemoryStorage(), persistentStorage));
    expect(concurrentId).not.toBe(originalId);

    originalLifecycle.dispatch("pagehide");
    await new Promise((resolve) => setTimeout(resolve, 0));
    const reopenedId = await initializeAuthTabId(initializeOptions(new MemoryStorage(), persistentStorage));
    expect(reopenedId).toBe(originalId);
  });

  it("serializa a recuperação concorrente mesmo sem Web Locks", async () => {
    channels.clear();
    const persistentStorage = new MemoryStorage();
    const savedId = "44444444-4444-4444-8444-444444444444";
    persistentStorage.setItem(`sb-project-auth-token-${savedId}`, "opaque-session");
    rememberAuthTab(savedId, persistentStorage);
    const initializeWithoutLocks = (tabStorage: MemoryStorage) => initializeAuthTabId({
      ...initializeOptions(tabStorage, persistentStorage),
      locks: null,
    });

    const [firstId, secondId] = await Promise.all([
      initializeWithoutLocks(new MemoryStorage()),
      initializeWithoutLocks(new MemoryStorage()),
    ]);

    expect([firstId, secondId].filter((id) => id === savedId)).toHaveLength(1);
    expect(firstId).not.toBe(secondId);
  });

  it("isola abas duplicadas usando eventos storage quando BroadcastChannel não existe", async () => {
    const persistentStorage = new MemoryStorage();
    const sourceStorage = new MemoryStorage();
    const bus = new SharedStorageBus();
    const sourceContext = bus.createContext();
    const duplicateContext = bus.createContext();
    const sourceLifecycle = lifecycleTarget();
    const duplicateLifecycle = lifecycleTarget();
    const createChannel = (context: StorageContext) => (name: string) =>
      createStoragePresenceChannel(name, context.storage, context);
    const sourceId = await initializeAuthTabId(initializeOptions(
      sourceStorage,
      persistentStorage,
      sourceLifecycle,
      createChannel(sourceContext),
      null,
    ));
    const duplicateId = await initializeAuthTabId(initializeOptions(
      sourceStorage.clone(),
      persistentStorage,
      duplicateLifecycle,
      createChannel(duplicateContext),
      null,
    ));

    expect(duplicateId).not.toBe(sourceId);
    sourceLifecycle.dispatch("pagehide");
    duplicateLifecycle.dispatch("pagehide");
    expect(bus.size).toBe(0);
  });

  it("elege uma única aba para recuperar sessão lembrada sem BroadcastChannel ou Web Locks", async () => {
    const persistentStorage = new MemoryStorage();
    const rememberedId = "55555555-5555-4555-8555-555555555555";
    persistentStorage.setItem(`sb-project-auth-token-${rememberedId}`, "opaque-session");
    rememberAuthTab(rememberedId, persistentStorage);
    const bus = new SharedStorageBus();
    const firstContext = bus.createContext();
    const secondContext = bus.createContext();
    const firstLifecycle = lifecycleTarget();
    const secondLifecycle = lifecycleTarget();
    const initializeFallback = (context: StorageContext) => initializeAuthTabId(initializeOptions(
      new MemoryStorage(),
      persistentStorage,
      context === firstContext ? firstLifecycle : secondLifecycle,
      (name) => createStoragePresenceChannel(name, context.storage, context),
      null,
    ));

    const [firstId, secondId] = await Promise.all([initializeFallback(firstContext), initializeFallback(secondContext)]);

    expect([firstId, secondId].filter((id) => id === rememberedId)).toHaveLength(1);
    expect(firstId).not.toBe(secondId);
    firstLifecycle.dispatch("pagehide");
    secondLifecycle.dispatch("pagehide");
    expect(bus.size).toBe(0);
  });

  it("usa uma aquisição exclusiva para recuperar sessões quando Web Locks não está disponível", async () => {
    const persistentStorage = new MemoryStorage();
    const rememberedId = "66666666-6666-4666-8666-666666666666";
    persistentStorage.setItem(`sb-project-auth-token-${rememberedId}`, "opaque-session");
    rememberAuthTab(rememberedId, persistentStorage);
    const acquired = new Set<string>();
    const leaseManager = {
      async tryAcquire(name: string) {
        if (acquired.has(name)) return null;
        acquired.add(name);
        return () => acquired.delete(name);
      },
    };
    const initializeWithLease = () => initializeAuthTabId(initializeOptions(
      new MemoryStorage(),
      persistentStorage,
      lifecycleTarget(),
      undefined,
      null,
      leaseManager,
    ));

    const [firstId, secondId] = await Promise.all([initializeWithLease(), initializeWithLease()]);

    expect([firstId, secondId].filter((id) => id === rememberedId)).toHaveLength(1);
    expect(firstId).not.toBe(secondId);
  });
});
