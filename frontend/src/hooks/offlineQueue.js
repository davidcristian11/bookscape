import { getStoredUser } from "../utils/authStorage.js";

const OFFLINE_QUEUE_EVENT = "bookscape:offline-queue-changed";

function getCurrentUserScope() {
  const user = getStoredUser();
  return user?.email ?? user?.id ?? "anonymous";
}

function getOfflineQueueStorageKey() {
  return `bookscape_offline_queue_${getCurrentUserScope()}`;
}

function readJson(key, fallbackValue) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallbackValue;
  } catch {
    return fallbackValue;
  }
}

function writeJson(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

function emitOfflineQueueChanged() {
  window.dispatchEvent(new CustomEvent(OFFLINE_QUEUE_EVENT));
}

function buildOperationId(type, id) {
  return `${type}-${id}`;
}

function getOperationKey(operation) {
  return (
    operation.operationId ||
    operation.id ||
    `${operation.type}-${operation.clientMutationId || operation.tempId || operation.bookId}`
  );
}

function normalizeQueue(queue) {
  const nextQueue = [];
  const seen = new Set();

  for (const operation of queue.filter(Boolean)) {
    if (["completed", "synced"].includes(operation.status)) {
      continue;
    }

    const clientMutationId =
      operation.clientMutationId || operation.tempId || operation.bookId;
    const operationId = getOperationKey({
      ...operation,
      clientMutationId,
    });

    if (!operationId || seen.has(operationId)) {
      continue;
    }

    seen.add(operationId);
    nextQueue.push({
      ...operation,
      id: operation.id || operationId,
      operationId,
      clientMutationId,
      status: operation.status || "pending",
    });
  }

  return nextQueue;
}

export function getOfflineQueueEventName() {
  return OFFLINE_QUEUE_EVENT;
}

export function getOfflineQueue() {
  const key = getOfflineQueueStorageKey();
  const rawQueue = readJson(key, []);
  const normalizedQueue = normalizeQueue(rawQueue);

  if (JSON.stringify(rawQueue) !== JSON.stringify(normalizedQueue)) {
    writeJson(key, normalizedQueue);
  }

  return normalizedQueue;
}

export function setOfflineQueue(queue) {
  writeJson(getOfflineQueueStorageKey(), normalizeQueue(queue));
  emitOfflineQueueChanged();
  return getOfflineQueue();
}

export function clearOfflineQueue() {
  return setOfflineQueue([]);
}

export function getOfflineQueueCount() {
  return getOfflineQueue().length;
}

export function enqueueCreateOperation(tempId, payload) {
  const queue = getOfflineQueue();

  if (
    queue.some(
      (operation) =>
        operation.type === "create" && operation.tempId === tempId
    )
  ) {
    return setOfflineQueue(queue);
  }

  queue.push({
    id: buildOperationId("create", tempId),
    operationId: buildOperationId("create", tempId),
    type: "create",
    tempId,
    clientMutationId: tempId,
    payload,
    status: "pending",
  });

  return setOfflineQueue(queue);
}

export function enqueueUpdateOperation(bookId, payload) {
  const queue = getOfflineQueue();

  const createIndex = queue.findIndex(
    (operation) =>
      operation.type === "create" && operation.tempId === bookId
  );

  if (createIndex !== -1) {
    queue[createIndex] = {
      ...queue[createIndex],
      payload: {
        ...queue[createIndex].payload,
        ...payload,
      },
    };

    return setOfflineQueue(queue);
  }

  const updateIndex = queue.findIndex(
    (operation) =>
      operation.type === "update" && operation.bookId === bookId
  );

  if (updateIndex !== -1) {
    queue[updateIndex] = {
      ...queue[updateIndex],
      payload: {
        ...queue[updateIndex].payload,
        ...payload,
      },
    };

    return setOfflineQueue(queue);
  }

  queue.push({
    id: buildOperationId("update", bookId),
    operationId: buildOperationId("update", bookId),
    type: "update",
    bookId,
    clientMutationId: bookId,
    payload,
    status: "pending",
  });

  return setOfflineQueue(queue);
}

export function enqueueDeleteOperation(bookId) {
  const queue = getOfflineQueue();

  const hasQueuedCreate = queue.some(
    (operation) =>
      operation.type === "create" && operation.tempId === bookId
  );

  if (hasQueuedCreate) {
    const nextQueue = queue.filter(
      (operation) =>
        !(
          (operation.type === "create" && operation.tempId === bookId) ||
          (operation.type === "update" && operation.bookId === bookId)
        )
    );

    return setOfflineQueue(nextQueue);
  }

  const nextQueue = queue.filter(
    (operation) =>
      !(
        (operation.type === "update" && operation.bookId === bookId) ||
        (operation.type === "delete" && operation.bookId === bookId)
      )
  );

  nextQueue.push({
    id: buildOperationId("delete", bookId),
    operationId: buildOperationId("delete", bookId),
    type: "delete",
    bookId,
    clientMutationId: bookId,
    status: "pending",
  });

  return setOfflineQueue(nextQueue);
}
