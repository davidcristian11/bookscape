import { getStoredUser } from "../utils/authStorage.js";

const OFFLINE_QUEUE_EVENT = "bookscape:offline-queue-changed";

function getCurrentUserScope() {
  return getStoredUser()?.id ?? "anonymous";
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

  queue.push({
    type: "create",
    tempId,
    payload,
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
    type: "update",
    bookId,
    payload,
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
    type: "delete",
    bookId,
  });

  return setOfflineQueue(nextQueue);
}