"""Initial persistent schema.

Revision ID: 0001_initial_persistent_schema
Revises:
Create Date: 2026-05-12
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "0001_initial_persistent_schema"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "permissions",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("name", sa.String(length=80), nullable=False),
        sa.Column("description", sa.String(length=255), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("name"),
    )
    op.create_index(op.f("ix_permissions_name"), "permissions", ["name"], unique=True)

    op.create_table(
        "roles",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("name", sa.String(length=50), nullable=False),
        sa.Column("description", sa.String(length=255), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("name"),
    )
    op.create_index(op.f("ix_roles_name"), "roles", ["name"], unique=True)

    op.create_table(
        "users",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("name", sa.String(length=100), nullable=False),
        sa.Column("email", sa.String(length=150), nullable=False),
        sa.Column("password_hash", sa.String(length=128), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("email"),
    )
    op.create_index(op.f("ix_users_email"), "users", ["email"], unique=True)

    op.create_table(
        "role_permissions",
        sa.Column("role_id", sa.String(length=36), nullable=False),
        sa.Column("permission_id", sa.String(length=36), nullable=False),
        sa.ForeignKeyConstraint(["permission_id"], ["permissions.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["role_id"], ["roles.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("role_id", "permission_id"),
    )

    op.create_table(
        "user_roles",
        sa.Column("user_id", sa.String(length=36), nullable=False),
        sa.Column("role_id", sa.String(length=36), nullable=False),
        sa.ForeignKeyConstraint(["role_id"], ["roles.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("user_id", "role_id"),
    )

    op.create_table(
        "books",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("user_id", sa.String(length=36), nullable=False),
        sa.Column("title", sa.String(length=200), nullable=False),
        sa.Column("author", sa.String(length=120), nullable=False),
        sa.Column("genre", sa.String(length=80), nullable=False),
        sa.Column("publication_year", sa.Integer(), nullable=False),
        sa.Column("source", sa.String(length=80), nullable=False),
        sa.Column("source_url", sa.String(length=500), nullable=True),
        sa.Column("synopsis", sa.Text(), nullable=False),
        sa.Column("review", sa.Text(), nullable=False),
        sa.Column("rating", sa.Integer(), nullable=False),
        sa.Column("cover_url", sa.String(length=500), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_books_genre"), "books", ["genre"], unique=False)
    op.create_index(op.f("ix_books_source"), "books", ["source"], unique=False)
    op.create_index(op.f("ix_books_user_id"), "books", ["user_id"], unique=False)

    op.create_table(
        "session_tokens",
        sa.Column("token", sa.String(length=96), nullable=False),
        sa.Column("user_id", sa.String(length=36), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("token"),
    )
    op.create_index(op.f("ix_session_tokens_user_id"), "session_tokens", ["user_id"], unique=False)

    op.create_table(
        "quote_cards",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("user_id", sa.String(length=36), nullable=False),
        sa.Column("book_id", sa.String(length=36), nullable=False),
        sa.Column("quote", sa.Text(), nullable=False),
        sa.Column("note", sa.Text(), nullable=True),
        sa.Column("relationship_label", sa.String(length=100), nullable=True),
        sa.Column("position_x", sa.Float(), nullable=False),
        sa.Column("position_y", sa.Float(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["book_id"], ["books.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_quote_cards_book_id"), "quote_cards", ["book_id"], unique=False)
    op.create_index(
        op.f("ix_quote_cards_relationship_label"),
        "quote_cards",
        ["relationship_label"],
        unique=False,
    )
    op.create_index(op.f("ix_quote_cards_user_id"), "quote_cards", ["user_id"], unique=False)

    op.create_table(
        "nexus_nodes",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("user_id", sa.String(length=36), nullable=False),
        sa.Column("book_title", sa.String(length=200), nullable=False),
        sa.Column("quote", sa.Text(), nullable=False),
        sa.Column("x", sa.Float(), nullable=False),
        sa.Column("y", sa.Float(), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_nexus_nodes_user_id"), "nexus_nodes", ["user_id"], unique=False)

    op.create_table(
        "log_entries",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("user_id", sa.String(length=36), nullable=True),
        sa.Column("role_name", sa.String(length=50), nullable=False),
        sa.Column("action", sa.String(length=80), nullable=False),
        sa.Column("details", sa.Text(), nullable=False),
        sa.Column("timestamp", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_log_entries_action"), "log_entries", ["action"], unique=False)
    op.create_index(op.f("ix_log_entries_role_name"), "log_entries", ["role_name"], unique=False)
    op.create_index(op.f("ix_log_entries_timestamp"), "log_entries", ["timestamp"], unique=False)
    op.create_index(op.f("ix_log_entries_user_id"), "log_entries", ["user_id"], unique=False)

    op.create_table(
        "observation_list_entries",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("user_id", sa.String(length=36), nullable=False),
        sa.Column("role_name", sa.String(length=50), nullable=False),
        sa.Column("reason", sa.Text(), nullable=False),
        sa.Column("score", sa.Integer(), nullable=False),
        sa.Column("last_action_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("user_id", name="uq_observation_user"),
    )
    op.create_index(
        op.f("ix_observation_list_entries_role_name"),
        "observation_list_entries",
        ["role_name"],
        unique=False,
    )
    op.create_index(
        op.f("ix_observation_list_entries_user_id"),
        "observation_list_entries",
        ["user_id"],
        unique=False,
    )

    op.create_table(
        "nexus_edges",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("user_id", sa.String(length=36), nullable=False),
        sa.Column("source_id", sa.String(length=36), nullable=False),
        sa.Column("target_id", sa.String(length=36), nullable=False),
        sa.Column("label", sa.String(length=120), nullable=True),
        sa.ForeignKeyConstraint(["source_id"], ["nexus_nodes.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["target_id"], ["nexus_nodes.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("user_id", "source_id", "target_id", name="uq_nexus_edge_pair"),
    )
    op.create_index(op.f("ix_nexus_edges_source_id"), "nexus_edges", ["source_id"], unique=False)
    op.create_index(op.f("ix_nexus_edges_target_id"), "nexus_edges", ["target_id"], unique=False)
    op.create_index(op.f("ix_nexus_edges_user_id"), "nexus_edges", ["user_id"], unique=False)


def downgrade() -> None:
    op.drop_index(op.f("ix_nexus_edges_user_id"), table_name="nexus_edges")
    op.drop_index(op.f("ix_nexus_edges_target_id"), table_name="nexus_edges")
    op.drop_index(op.f("ix_nexus_edges_source_id"), table_name="nexus_edges")
    op.drop_table("nexus_edges")
    op.drop_index(op.f("ix_observation_list_entries_user_id"), table_name="observation_list_entries")
    op.drop_index(op.f("ix_observation_list_entries_role_name"), table_name="observation_list_entries")
    op.drop_table("observation_list_entries")
    op.drop_index(op.f("ix_log_entries_user_id"), table_name="log_entries")
    op.drop_index(op.f("ix_log_entries_timestamp"), table_name="log_entries")
    op.drop_index(op.f("ix_log_entries_role_name"), table_name="log_entries")
    op.drop_index(op.f("ix_log_entries_action"), table_name="log_entries")
    op.drop_table("log_entries")
    op.drop_index(op.f("ix_nexus_nodes_user_id"), table_name="nexus_nodes")
    op.drop_table("nexus_nodes")
    op.drop_index(op.f("ix_quote_cards_user_id"), table_name="quote_cards")
    op.drop_index(op.f("ix_quote_cards_relationship_label"), table_name="quote_cards")
    op.drop_index(op.f("ix_quote_cards_book_id"), table_name="quote_cards")
    op.drop_table("quote_cards")
    op.drop_index(op.f("ix_session_tokens_user_id"), table_name="session_tokens")
    op.drop_table("session_tokens")
    op.drop_index(op.f("ix_books_user_id"), table_name="books")
    op.drop_index(op.f("ix_books_source"), table_name="books")
    op.drop_index(op.f("ix_books_genre"), table_name="books")
    op.drop_table("books")
    op.drop_table("user_roles")
    op.drop_table("role_permissions")
    op.drop_index(op.f("ix_users_email"), table_name="users")
    op.drop_table("users")
    op.drop_index(op.f("ix_roles_name"), table_name="roles")
    op.drop_table("roles")
    op.drop_index(op.f("ix_permissions_name"), table_name="permissions")
    op.drop_table("permissions")
