# BookScape Backend

BookScape is a simple in-memory REST API built with FastAPI for managing books.

This project was created for a university assignment and implements the **Bronze requirements**:
- CRUD operations for books
- server-side validation
- pagination
- statistics endpoint
- separated layers (routes, services, repositories, schemas)
- tests for important operations
- in-memory storage only

## Tech Stack

- Python
- FastAPI
- Pydantic
- pytest

## Project Structure

```text
backend/
  app/
    main.py
    routes/
      books.py
      stats.py
    schemas/
      book.py
    services/
      book_service.py
      stats_service.py
    repositories/
      book_repository.py
    models/
      book_model.py
  tests/
    test_books.py
    test_stats.py
  requirements.txt