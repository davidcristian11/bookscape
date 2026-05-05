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

export function getOfflineQueueEventName() {
  return OFFLINE_QUEUE_EVENT;
}

export function getOfflineQueue() {
  return readJson(getOfflineQueueStorageKey(), []);
}

export function setOfflineQueue(queue) {
  writeJson(getOfflineQueueStorageKey(), queue);
  emitOfflineQueueChanged();
  return queue;
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
    type: "create",
    tempId,
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
    type: "update",
    bookId,
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
    type: "delete",
    bookId,
    status: "pending",
  });

  return setOfflineQueue(nextQueue);
}
