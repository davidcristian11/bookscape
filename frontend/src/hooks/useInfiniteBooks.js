import { useCallback, useEffect, useRef, useState } from "react";
import { getBooks } from "../api/booksApi";

export default function useInfiniteBooks(pageSize) {
  const [books, setBooks] = useState([]);
  const [totalBooks, setTotalBooks] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [currentLoadedPage, setCurrentLoadedPage] = useState(0);

  const [loadingInitial, setLoadingInitial] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState("");

  const prefetchedPageRef = useRef(null);
  const isFetchingRef = useRef(false);

  const prefetchNextPage = useCallback(async (currentPage, totalPagesValue) => {
    const nextPage = currentPage + 1;

    if (nextPage > totalPagesValue || totalPagesValue === 0) {
      prefetchedPageRef.current = null;
      return;
    }

    if (prefetchedPageRef.current?.page === nextPage) {
      return;
    }

    try {
      const nextPageData = await getBooks(nextPage, pageSize);
      prefetchedPageRef.current = {
        page: nextPage,
        data: nextPageData,
      };
    } catch {
      prefetchedPageRef.current = null;
    }
  }, [pageSize]);

  const loadFirstPage = useCallback(async () => {
    try {
      isFetchingRef.current = true;
      setLoadingInitial(true);
      setError("");

      const firstPageData = await getBooks(1, pageSize);

      setBooks(firstPageData.items);
      setTotalBooks(firstPageData.total);
      setTotalPages(firstPageData.total_pages);
      setCurrentLoadedPage(firstPageData.total_pages > 0 ? 1 : 0);

      await prefetchNextPage(1, firstPageData.total_pages);
    } catch (err) {
      setError(err.message || "Failed to load books.");
      setBooks([]);
      setTotalBooks(0);
      setTotalPages(0);
      setCurrentLoadedPage(0);
      prefetchedPageRef.current = null;
    } finally {
      isFetchingRef.current = false;
      setLoadingInitial(false);
    }
  }, [pageSize, prefetchNextPage]);

  const loadNextPage = useCallback(async () => {
    if (isFetchingRef.current) {
      return;
    }

    if (currentLoadedPage === 0 || currentLoadedPage >= totalPages) {
      return;
    }

    const nextPage = currentLoadedPage + 1;

    try {
      isFetchingRef.current = true;
      setLoadingMore(true);
      setError("");

      let nextPageData = null;

      if (prefetchedPageRef.current?.page === nextPage) {
        nextPageData = prefetchedPageRef.current.data;
        prefetchedPageRef.current = null;
      } else {
        nextPageData = await getBooks(nextPage, pageSize);
      }

      setBooks((prevBooks) => [...prevBooks, ...nextPageData.items]);
      setTotalBooks(nextPageData.total);
      setTotalPages(nextPageData.total_pages);
      setCurrentLoadedPage(nextPage);

      await prefetchNextPage(nextPage, nextPageData.total_pages);
    } catch (err) {
      setError(err.message || "Failed to load more books.");
    } finally {
      isFetchingRef.current = false;
      setLoadingMore(false);
    }
  }, [currentLoadedPage, totalPages, pageSize, prefetchNextPage]);

  const refreshFromStart = useCallback(async () => {
    prefetchedPageRef.current = null;
    setCurrentLoadedPage(0);
    await loadFirstPage();
  }, [loadFirstPage]);

  useEffect(() => {
    refreshFromStart();
  }, [refreshFromStart]);

  return {
    books,
    totalBooks,
    totalPages,
    currentLoadedPage,
    loadingInitial,
    loadingMore,
    error,
    hasMore: currentLoadedPage > 0 && currentLoadedPage < totalPages,
    loadNextPage,
    refreshFromStart,
  };
}