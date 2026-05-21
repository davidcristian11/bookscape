import { beforeEach, describe, expect, it } from "vitest";
import {
  getLocalBooksCache,
  reconcileServerBooks,
  setLocalBooksCache,
} from "../localBooksStore";

function saveTestUser() {
  localStorage.setItem(
    "bookscape_auth_user",
    JSON.stringify({ id: "user-1", name: "Reader", email: "reader@example.com" })
  );
}

const oldSeedBooks = [
  { id: "old-dune", title: "Dune", author: "Frank Herbert", genre: "Sci-Fi", rating: 5 },
  { id: "old-1984", title: "1984", author: "George Orwell", genre: "Dystopia", rating: 5 },
  { id: "old-habits", title: "Atomic Habits", author: "James Clear", genre: "Self-improvement", rating: 4 },
];

const newSeedBooks = [
  { id: "new-dune", title: "Dune", author: "Frank Herbert", genre: "Sci-Fi", rating: 5 },
  { id: "new-1984", title: "1984", author: "George Orwell", genre: "Dystopia", rating: 5 },
  { id: "new-habits", title: "Atomic Habits", author: "James Clear", genre: "Self-improvement", rating: 4 },
];

describe("localBooksStore reconciliation", () => {
  beforeEach(() => {
    localStorage.clear();
    saveTestUser();
  });

  it("normalizes duplicated seeded books to one title-author pair each", () => {
    setLocalBooksCache([...oldSeedBooks, ...oldSeedBooks]);

    const books = getLocalBooksCache();

    expect(books).toHaveLength(3);
    expect(books.filter((book) => book.title === "Dune")).toHaveLength(1);
    expect(books.filter((book) => book.title === "1984")).toHaveLength(1);
    expect(books.filter((book) => book.title === "Atomic Habits")).toHaveLength(1);
  });

  it("replaces stale canonical seed books after backend restart while preserving pending optimistic books", () => {
    const pendingBook = {
      id: "offline-1",
      title: "Offline Added",
      author: "Local Reader",
      genre: "Memoir",
      rating: 4,
      _offline: true,
      _syncStatus: "pending",
      _clientMutationId: "offline-1",
    };
    setLocalBooksCache([...oldSeedBooks, pendingBook]);

    reconcileServerBooks(newSeedBooks, { replaceCanonical: true });

    const books = getLocalBooksCache();

    expect(books).toHaveLength(4);
    expect(books.find((book) => book.title === "Dune").id).toBe("new-dune");
    expect(books.find((book) => book.title === "1984").id).toBe("new-1984");
    expect(books.find((book) => book.title === "Atomic Habits").id).toBe("new-habits");
    expect(books.find((book) => book.title === "Offline Added").id).toBe("offline-1");
  });
});
