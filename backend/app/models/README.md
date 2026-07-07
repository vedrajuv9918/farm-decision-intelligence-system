# Persistence Model

The backend is configured for PostgreSQL through `DATABASE_URL`. `DecisionRecord` is ready for storing generated recommendations, audit trails, and advisor review history. The current route layer keeps decisions stateless for easier classroom/demo setup, while the database module can be enabled in production by calling `init_db()` on startup and inserting records from route handlers.
