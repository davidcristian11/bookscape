import threading
from uuid import uuid4

from faker import Faker

from app.models.book_model import Book
from app.repositories.book_repository import BookRepository
from app.schemas.book import BookResponse
from app.schemas.automation import FakerLoopStatusResponse
from app.services.realtime_service import RealtimeService


class FakerAutomationService:
    def __init__(
        self,
        book_repository: BookRepository,
        realtime_service: RealtimeService,
    ) -> None:
        self.book_repository = book_repository
        self.realtime_service = realtime_service
        self._faker = Faker()

        self._threads: dict[str, threading.Thread] = {}
        self._stop_events: dict[str, threading.Event] = {}
        self._intervals: dict[str, float] = {}

        self._genres = [
            "Fantasy",
            "Sci-Fi",
            "Mystery",
            "Romance",
            "Thriller",
            "Dystopian",
            "Classic",
            "Adventure",
            "Historical Fiction",
            "Horror",
        ]
        self._statuses = ["to-read", "reading", "finished"]

    def is_running(self, user_id: str) -> bool:
        thread = self._threads.get(user_id)
        return thread is not None and thread.is_alive()

    def force_reset(self) -> None:
        for stop_event in self._stop_events.values():
            stop_event.set()

        for thread in self._threads.values():
            thread.join(timeout=1)

        self._threads.clear()
        self._stop_events.clear()
        self._intervals.clear()

    def _build_fake_book(self, user_id: str) -> Book:
        return Book(
            user_id=user_id,
            id=str(uuid4()),
            title=self._faker.sentence(nb_words=3).rstrip("."),
            author=self._faker.name(),
            genre=self._faker.random_element(self._genres),
            year=self._faker.random_int(min=1950, max=2025),
            status=self._faker.random_element(self._statuses),
            rating=self._faker.random_int(min=1, max=5),
            cover_url=None,
        )

    def _run_loop(
        self,
        user_id: str,
        interval_seconds: float,
        stop_event: threading.Event,
    ) -> None:
        while not stop_event.wait(interval_seconds):
            book = self._build_fake_book(user_id)
            self.book_repository.create(book)

            self.realtime_service.broadcast_to_user_from_thread(
                user_id,
                {
                    "type": "book_created",
                    "source": "faker_loop",
                    "book": BookResponse.model_validate(book).model_dump(),
                },
            )

    async def start(
        self,
        user_id: str,
        interval_seconds: float,
    ) -> FakerLoopStatusResponse:
        if self.is_running(user_id):
            raise ValueError("Faker loop is already running")

        stop_event = threading.Event()
        thread = threading.Thread(
            target=self._run_loop,
            args=(user_id, interval_seconds, stop_event),
            daemon=True,
        )

        self._stop_events[user_id] = stop_event
        self._threads[user_id] = thread
        self._intervals[user_id] = interval_seconds

        thread.start()

        self.realtime_service.broadcast_to_user_from_thread(
            user_id,
            {
                "type": "faker_started",
                "interval_seconds": interval_seconds,
            },
        )

        return FakerLoopStatusResponse(
            message="Faker loop started successfully",
            running=True,
            interval_seconds=interval_seconds,
        )

    async def stop(self, user_id: str) -> FakerLoopStatusResponse:
        thread = self._threads.get(user_id)
        stop_event = self._stop_events.get(user_id)

        if thread is None or stop_event is None or not thread.is_alive():
            return FakerLoopStatusResponse(
                message="Faker loop is not running",
                running=False,
                interval_seconds=None,
            )

        interval_seconds = self._intervals.get(user_id)

        stop_event.set()
        thread.join(timeout=1)

        self._threads.pop(user_id, None)
        self._stop_events.pop(user_id, None)
        self._intervals.pop(user_id, None)

        self.realtime_service.broadcast_to_user_from_thread(
            user_id,
            {
                "type": "faker_stopped",
            },
        )

        return FakerLoopStatusResponse(
            message="Faker loop stopped successfully",
            running=False,
            interval_seconds=interval_seconds,
        )