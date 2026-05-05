import { getStoredUser } from "./authStorage";

const BOOKS_CHANGED_EVENT = "bookscape:books-changed";

function getCurrentUserScope() {
  const user = getStoredUser();
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

export function getBooksChangedEventName() {
  return BOOKS_CHANGED_EVENT;
}

export function emitBooksChanged() {
  window.dispatchEvent(new CustomEvent(BOOKS_CHANGED_EVENT));
}

export function getLocalBooksCache() {
  return readJson(getBooksStorageKey(), []);
}

export function setLocalBooksCache(books) {
  writeJson(getBooksStorageKey(), books);
  emitBooksChanged();
  return books;
}

export function mergeLocalBooks(incomingBooks) {
  const currentBooks = getLocalBooksCache();
  const indexById = new Map(
    currentBooks.map((book, index) => [book.id, index])
  );
  const indexByClientMutationId = new Map(
    currentBooks
      .map((book, index) => [book._clientMutationId, index])
      .filter(([clientMutationId]) => Boolean(clientMutationId))
  );

  const nextBooks = [...currentBooks];

  for (const incomingBook of incomingBooks) {
    const existingIndex =
      indexById.get(incomingBook.id) ??
      indexByClientMutationId.get(incomingBook._clientMutationId);

    if (existingIndex === undefined) {
      nextBooks.push(incomingBook);
      indexById.set(incomingBook.id, nextBooks.length - 1);
      if (incomingBook._clientMutationId) {
        indexByClientMutationId.set(
          incomingBook._clientMutationId,
          nextBooks.length - 1
        );
      }
    } else {
      nextBooks[existingIndex] = {
        ...nextBooks[existingIndex],
        ...incomingBook,
      };
    }
  }

  return setLocalBooksCache(nextBooks);
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
