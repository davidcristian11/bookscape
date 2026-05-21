from app.repositories.book_repository import BookRepository
from app.repositories.activity_repository import ActivityRepository
from app.repositories.nexus_repository import NexusRepository
from app.repositories.quote_card_repository import QuoteCardRepository
from app.repositories.session_repository import SessionRepository
from app.repositories.user_repository import UserRepository
from app.services.auth_service import AuthService
from app.services.book_service import BookService
from app.services.chat_service import ChatService
from app.services.faker_automation_service import FakerAutomationService
from app.services.logging_service import LoggingService
from app.services.nexus_service import NexusService
from app.services.quote_card_service import QuoteCardService
from app.services.realtime_service import RealtimeService
from app.services.scraper_service import ScraperService
from app.services.seed_service import SeedService
from app.services.stats_service import StatsService

user_repository = UserRepository()
session_repository = SessionRepository()
book_repository = BookRepository()
nexus_repository = NexusRepository()
quote_card_repository = QuoteCardRepository()
activity_repository = ActivityRepository()

realtime_service = RealtimeService()
scraper_service = ScraperService()
chat_service = ChatService()
logging_service = LoggingService(activity_repository)

auth_service = AuthService(user_repository, session_repository, logging_service)
book_service = BookService(book_repository, scraper_service)
stats_service = StatsService(book_repository, quote_card_repository)
nexus_service = NexusService(nexus_repository)
quote_card_service = QuoteCardService(quote_card_repository, book_repository)
faker_automation_service = FakerAutomationService(book_repository, realtime_service)
seed_service = SeedService(book_repository, quote_card_repository, user_repository)
