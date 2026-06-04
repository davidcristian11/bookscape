from datetime import datetime, timezone
from uuid import uuid4

from app.core.security import hash_password
from app.models.book_model import Book
from app.models.quote_card_model import QuoteCard
from app.repositories.book_repository import BookRepository
from app.repositories.quote_card_repository import QuoteCardRepository
from app.repositories.user_repository import UserRepository


class SeedService:
    def __init__(
        self,
        book_repository: BookRepository,
        quote_repository: QuoteCardRepository,
        user_repository: UserRepository,
    ) -> None:
        self.book_repository = book_repository
        self.quote_repository = quote_repository
        self.user_repository = user_repository

    def seed_auth_defaults(self) -> None:
        permissions = {
            "books:read": "Read books and statistics",
            "books:write": "Create and update books",
            "books:delete": "Delete books",
            "quote_cards:write": "Create, update, and delete quote cards",
            "nexus:write": "Create and manage Idea Nexus nodes and edges",
            "automation:write": "Start and stop personal Faker book generation",
            "chat:read": "Read chat messages",
            "chat:write": "Send chat messages",
            "admin:read": "View admin-only areas",
            "logs:read": "View logs and observation list",
        }

        for name, description in permissions.items():
            self.user_repository.ensure_permission(name, description)

        self.user_repository.ensure_role("admin", "Administrator with full BookScape access")
        self.user_repository.ensure_role("user", "Normal reader with library and chat access")

        for permission in permissions:
            self.user_repository.assign_permission_to_role("admin", permission)

        for permission in (
            "books:read",
            "books:write",
            "books:delete",
            "quote_cards:write",
            "nexus:write",
            "automation:write",
            "chat:read",
            "chat:write",
        ):
            self.user_repository.assign_permission_to_role("user", permission)

        self.user_repository.ensure_user(
            name="BookScape Admin",
            email="admin@bookscape.test",
            password_hash=hash_password("admin123"),
            role_name="admin",
        )
        self.user_repository.ensure_user(
            name="BookScape Reader",
            email="reader@bookscape.test",
            password_hash=hash_password("reader123"),
            role_name="user",
        )

    def seed_user_library(self, user_id: str) -> None:
        if self.book_repository.list_all(user_id):
            return

        now = datetime.now(timezone.utc)
        books = [
            Book(
                user_id=user_id,
                id=str(uuid4()),
                title="Dune",
                author="Frank Herbert",
                genre="Sci-Fi",
                publication_year=1965,
                source="Goodreads",
                source_url="https://www.goodreads.com/book/show/44767458-dune",
                synopsis="A desert planet, political inheritance, and ecological destiny collide.",
                review="A layered study of power, myth, and survival.",
                rating=5,
                cover_url=None,
                created_at=now,
                updated_at=now,
            ),
            Book(
                user_id=user_id,
                id=str(uuid4()),
                title="1984",
                author="George Orwell",
                genre="Dystopian",
                publication_year=1949,
                source="Open Library",
                source_url="https://openlibrary.org/works/OL1168083W/Nineteen_Eighty-Four",
                synopsis="A surveillance-state novel about language, fear, and memory.",
                review="Bleak, precise, and still culturally urgent.",
                rating=4,
                cover_url=None,
                created_at=now,
                updated_at=now,
            ),
            Book(
                user_id=user_id,
                id=str(uuid4()),
                title="Atomic Habits",
                author="James Clear",
                genre="Self-improvement",
                publication_year=2018,
                source="Amazon",
                source_url="https://www.amazon.com/dp/0735211299",
                synopsis="A practical framework for small changes that compound into better systems.",
                review="Useful for turning vague goals into repeatable behavior.",
                rating=4,
                cover_url=None,
                created_at=now,
                updated_at=now,
            ),
        ]

        for book in books:
            self.book_repository.create(book)

        quote_specs = [
            (books[0], "Survival begins with attention to the world around you.", "Ecology as a form of resilience.", "Resilience", 80, 80),
            (books[0], "Power changes the person who believes they only hold it temporarily.", "A caution for every chosen-one story.", "Change", 420, 120),
            (books[1], "Identity becomes fragile when memory can be rewritten.", "Language shapes the self.", "Identity", 220, 320),
            (books[1], "Regret is sharpened by knowing exactly when courage failed.", "Useful bridge into personal notes.", "Regret", 560, 300),
            (books[2], "Every system is a vote for the person you are becoming.", "Tiny actions as identity practice.", "Self-improvement", 760, 120),
        ]

        for book, quote, note, label, x, y in quote_specs:
            self.quote_repository.create(
                QuoteCard(
                    user_id=user_id,
                    id=str(uuid4()),
                    book_id=book.id,
                    quote=quote,
                    note=note,
                    relationship_label=label,
                    position_x=x,
                    position_y=y,
                    created_at=now,
                    updated_at=now,
                )
            )
