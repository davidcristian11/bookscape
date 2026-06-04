import { getLastKnownUser, getStoredUser } from "./authStorage";

const BOOKS_CHANGED_EVENT = "bookscape:books-changed";

function getCurrentUserScope() {
  const user = getStoredUser() || getLastKnownUser();
  return user?.email ?? user?.id ?? "anonymous";
}

function getBooksStorageKey() {
  return `bookscape_books_cache_${getCurrentUserScope()}`;
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

function normalizeText(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

function getTitleAuthorKey(book) {
  const title = normalizeText(book.title);
  const author = normalizeText(book.author);
  return title && author ? `${title}::${author}` : "";
}

export function isPendingOptimisticBook(book) {
  return Boolean(
    book?._offline ||
      String(book?.id || "").startsWith("offline-") ||
      ["pending", "failed", "auth-required"].includes(book?._syncStatus)
  );
}

function preferBook(existingBook, incomingBook) {
  if (!existingBook) return incomingBook;

  const existingPending = isPendingOptimisticBook(existingBook);
  const incomingPending = isPendingOptimisticBook(incomingBook);

  if (existingPending && !incomingPending) {
    return {
      ...incomingBook,
      _clientMutationId: existingBook._clientMutationId,
    };
  }

  if (!existingPending && incomingPending) {
    return existingBook;
  }

  return {
    ...existingBook,
    ...incomingBook,
  };
}

export function normalizeBooks(books) {
  const normalizedBooks = [];
  const indexById = new Map();
  const indexByClientMutationId = new Map();
  const indexByTitleAuthor = new Map();

  for (const book of books.filter(Boolean)) {
    const clientMutationId = book._clientMutationId || null;
    const titleAuthorKey = getTitleAuthorKey(book);
    const isPending = isPendingOptimisticBook(book);

    let existingIndex = book.id ? indexById.get(book.id) : undefined;

    if (existingIndex === undefined && clientMutationId) {
      existingIndex = indexByClientMutationId.get(clientMutationId);
    }

    if (existingIndex === undefined && titleAuthorKey && !isPending) {
      existingIndex = indexByTitleAuthor.get(titleAuthorKey);
    }

    if (existingIndex === undefined) {
      normalizedBooks.push(book);
      const nextIndex = normalizedBooks.length - 1;
      if (book.id) indexById.set(book.id, nextIndex);
      if (clientMutationId) indexByClientMutationId.set(clientMutationId, nextIndex);
      if (titleAuthorKey && !isPending) indexByTitleAuthor.set(titleAuthorKey, nextIndex);
      continue;
    }

    const preferredBook = preferBook(normalizedBooks[existingIndex], book);
    normalizedBooks[existingIndex] = preferredBook;
    if (preferredBook.id) indexById.set(preferredBook.id, existingIndex);
    if (preferredBook._clientMutationId) {
      indexByClientMutationId.set(preferredBook._clientMutationId, existingIndex);
    }
    const preferredTitleAuthorKey = getTitleAuthorKey(preferredBook);
    if (preferredTitleAuthorKey && !isPendingOptimisticBook(preferredBook)) {
      indexByTitleAuthor.set(preferredTitleAuthorKey, existingIndex);
    }
  }

  return normalizedBooks;
}

function readNormalizedBooks() {
  const key = getBooksStorageKey();
  const rawBooks = readJson(key, []);
  const normalizedBooks = normalizeBooks(rawBooks);

  if (JSON.stringify(rawBooks) !== JSON.stringify(normalizedBooks)) {
    writeJson(key, normalizedBooks);
  }

  return normalizedBooks;
}

export function getBooksChangedEventName() {
  return BOOKS_CHANGED_EVENT;
}

export function emitBooksChanged() {
  window.dispatchEvent(new CustomEvent(BOOKS_CHANGED_EVENT));
}

export function getLocalBooksCache() {
  return readNormalizedBooks();
}

export function setLocalBooksCache(books) {
  writeJson(getBooksStorageKey(), normalizeBooks(books));
  emitBooksChanged();
  return getLocalBooksCache();
}

export function reconcileServerBooks(incomingBooks, { replaceCanonical = false } = {}) {
  const currentBooks = getLocalBooksCache();
  const pendingOptimisticBooks = currentBooks.filter(isPendingOptimisticBook);
  const existingCanonicalBooks = replaceCanonical
    ? []
    : currentBooks.filter((book) => !isPendingOptimisticBook(book));

  return setLocalBooksCache([
    ...existingCanonicalBooks,
    ...incomingBooks.map((book) => ({
      ...book,
      _offline: false,
      _syncStatus: undefined,
    })),
    ...pendingOptimisticBooks,
  ]);
}

export function mergeLocalBooks(incomingBooks) {
  return reconcileServerBooks(incomingBooks, { replaceCanonical: false });
}

export function upsertLocalBook(book) {
  const currentBooks = getLocalBooksCache();
  const existingIndex = currentBooks.findIndex(
    (currentBook) =>
      currentBook.id === book.id ||
      (book._clientMutationId &&
        currentBook._clientMutationId === book._clientMutationId)
  );

  if (existingIndex === -1) {
    return setLocalBooksCache([...currentBooks, book]);
  }

  const nextBooks = [...currentBooks];
  nextBooks[existingIndex] = {
    ...nextBooks[existingIndex],
    ...book,
  };

  return setLocalBooksCache(nextBooks);
}

export function getLocalBookById(bookId) {
  return getLocalBooksCache().find((book) => book.id === bookId) ?? null;
}

export function removeLocalBook(bookId) {
  const nextBooks = getLocalBooksCache().filter((book) => book.id !== bookId);
  return setLocalBooksCache(nextBooks);
}

export function getLocalPaginatedBooks(page = 1, pageSize = 10) {
  const books = getLocalBooksCache();
  const total = books.length;
  const totalPages = total > 0 ? Math.ceil(total / pageSize) : 0;

  const startIndex = (page - 1) * pageSize;
  const endIndex = startIndex + pageSize;

  return {
    items: books.slice(startIndex, endIndex),
    total,
    page,
    page_size: pageSize,
    total_pages: totalPages,
  };
}

export function computeLocalBookStats() {
  const books = getLocalBooksCache();

  const booksByGenre = {};
  const booksBySource = {};
  const booksByMonth = {};
  const sourceRatings = {};

  for (const book of books) {
    booksByGenre[book.genre] = (booksByGenre[book.genre] ?? 0) + 1;
    booksBySource[book.source || "Manual"] =
      (booksBySource[book.source || "Manual"] ?? 0) + 1;

    const month = book.created_at
      ? String(book.created_at).slice(0, 7)
      : "offline";
    booksByMonth[month] = (booksByMonth[month] ?? 0) + 1;

    const source = book.source || "Manual";
    sourceRatings[source] = sourceRatings[source] || [];
    sourceRatings[source].push(Number(book.rating || 0));
  }

  const averageRating =
    books.length > 0
      ? Number(
          (
            books.reduce((sum, book) => sum + Number(book.rating || 0), 0) /
            books.length
          ).toFixed(2)
        )
      : null;

  const topRatedSources = Object.fromEntries(
    Object.entries(sourceRatings).map(([source, ratings]) => [
      source,
      Number(
        (
          ratings.reduce((sum, rating) => sum + rating, 0) / ratings.length
        ).toFixed(2)
      ),
    ])
  );

  return {
    total_books: books.length,
    average_rating: averageRating,
    books_by_genre: booksByGenre,
    books_by_source: booksBySource,
    books_by_month: booksByMonth,
    top_rated_sources: topRatedSources,
    quotes_per_book: {},
  };
}
