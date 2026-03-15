"""repair missing core music tables

Revision ID: 1f6b9e3c4d2a
Revises: 
Create Date: 2026-03-12 20:05:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect


# revision identifiers, used by Alembic.
revision: str = "1f6b9e3c4d2a"
down_revision: Union[str, Sequence[str], None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


MIX_TABLE = "mixes"
ARTIST_TABLE = "artists"
CATEGORY_TABLE = "categories"
MIX_CATEGORY_TABLE = "mix_category"
TRACKLIST_TABLE = "tracklist_items"


def _inspector():
    return inspect(op.get_bind())


def _has_table(table_name: str) -> bool:
    return table_name in _inspector().get_table_names()


def _has_index(table_name: str, index_name: str) -> bool:
    return any(index.get("name") == index_name for index in _inspector().get_indexes(table_name))


def _create_artists() -> None:
    if _has_table(ARTIST_TABLE):
        return

    op.create_table(
        ARTIST_TABLE,
        sa.Column("id", sa.Integer(), primary_key=True, nullable=False),
        sa.Column("name", sa.String(), nullable=False),
    )
    op.create_index("ix_artists_id", ARTIST_TABLE, ["id"], unique=False)
    op.create_index("ix_artists_name", ARTIST_TABLE, ["name"], unique=False)


def _create_categories() -> None:
    if _has_table(CATEGORY_TABLE):
        return

    op.create_table(
        CATEGORY_TABLE,
        sa.Column("id", sa.Integer(), primary_key=True, nullable=False),
        sa.Column("name", sa.String(), nullable=False),
        sa.Column("description", sa.String(), nullable=True),
        sa.UniqueConstraint("name", name="uq_categories_name"),
    )
    op.create_index("ix_categories_id", CATEGORY_TABLE, ["id"], unique=False)
    op.create_index("ix_categories_name", CATEGORY_TABLE, ["name"], unique=True)


def _create_mixes() -> None:
    if _has_table(MIX_TABLE):
        return

    op.create_table(
        MIX_TABLE,
        sa.Column("id", sa.Integer(), primary_key=True, nullable=False),
        sa.Column("title", sa.String(), nullable=False),
        sa.Column("original_filename", sa.String(), nullable=True),
        sa.Column("duration_seconds", sa.Integer(), nullable=False),
        sa.Column("file_path", sa.String(), nullable=False),
        sa.Column("cover_art_url", sa.String(), nullable=True),
        sa.Column("file_size_mb", sa.Float(), nullable=False),
        sa.Column("quality_kbps", sa.Integer(), nullable=False),
        sa.Column("bpm", sa.Integer(), nullable=True),
        sa.Column("release_date", sa.DateTime(timezone=True), nullable=True, server_default=sa.func.now()),
        sa.Column("description", sa.String(), nullable=True),
        sa.Column("tracklist", sa.String(), nullable=True),
        sa.Column("tags", sa.String(), nullable=True),
        sa.Column("genre", sa.String(), nullable=True),
        sa.Column("album", sa.String(), nullable=True),
        sa.Column("year", sa.Integer(), nullable=True),
        sa.Column("availability", sa.String(), nullable=True, server_default=sa.text("'public'")),
        sa.Column("allow_downloads", sa.String(), nullable=True, server_default=sa.text("'yes'")),
        sa.Column("display_embed", sa.String(), nullable=True, server_default=sa.text("'yes'")),
        sa.Column("age_restriction", sa.String(), nullable=True, server_default=sa.text("'all'")),
        sa.Column("play_count", sa.Integer(), nullable=True, server_default=sa.text("0")),
        sa.Column("download_count", sa.Integer(), nullable=True, server_default=sa.text("0")),
        sa.Column("artist_id", sa.Integer(), nullable=False),
        sa.ForeignKeyConstraint(["artist_id"], [f"{ARTIST_TABLE}.id"], name="fk_mixes_artist_id_artists", ondelete="RESTRICT"),
        sa.UniqueConstraint("file_path", name="uq_mixes_file_path"),
    )
    op.create_index("ix_mixes_id", MIX_TABLE, ["id"], unique=False)
    op.create_index("ix_mixes_title", MIX_TABLE, ["title"], unique=False)
    op.create_index("ix_mixes_artist_id", MIX_TABLE, ["artist_id"], unique=False)


def _create_mix_category() -> None:
    if _has_table(MIX_CATEGORY_TABLE):
        return

    op.create_table(
        MIX_CATEGORY_TABLE,
        sa.Column("mix_id", sa.Integer(), nullable=False),
        sa.Column("category_id", sa.Integer(), nullable=False),
        sa.ForeignKeyConstraint(["mix_id"], [f"{MIX_TABLE}.id"], name="fk_mix_category_mix_id_mixes", ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["category_id"], [f"{CATEGORY_TABLE}.id"], name="fk_mix_category_category_id_categories", ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("mix_id", "category_id", name="pk_mix_category"),
    )
    op.create_index("ix_mix_category_category_id", MIX_CATEGORY_TABLE, ["category_id"], unique=False)


def _create_tracklist_items() -> None:
    if _has_table(TRACKLIST_TABLE):
        return

    op.create_table(
        TRACKLIST_TABLE,
        sa.Column("id", sa.Integer(), primary_key=True, nullable=False),
        sa.Column("track_title", sa.String(), nullable=False),
        sa.Column("track_artist", sa.String(), nullable=False),
        sa.Column("timestamp_seconds", sa.Integer(), nullable=False),
        sa.Column("mix_id", sa.Integer(), nullable=False),
        sa.ForeignKeyConstraint(["mix_id"], [f"{MIX_TABLE}.id"], name="fk_tracklist_items_mix_id_mixes", ondelete="CASCADE"),
    )
    op.create_index("ix_tracklist_items_id", TRACKLIST_TABLE, ["id"], unique=False)
    op.create_index("ix_tracklist_items_mix_id", TRACKLIST_TABLE, ["mix_id"], unique=False)


def upgrade() -> None:
    _create_artists()
    _create_categories()
    _create_mixes()
    _create_mix_category()
    _create_tracklist_items()


def downgrade() -> None:
    inspector = _inspector()

    if TRACKLIST_TABLE in inspector.get_table_names():
        if _has_index(TRACKLIST_TABLE, "ix_tracklist_items_mix_id"):
            op.drop_index("ix_tracklist_items_mix_id", table_name=TRACKLIST_TABLE)
        if _has_index(TRACKLIST_TABLE, "ix_tracklist_items_id"):
            op.drop_index("ix_tracklist_items_id", table_name=TRACKLIST_TABLE)
        op.drop_table(TRACKLIST_TABLE)

    if MIX_CATEGORY_TABLE in inspector.get_table_names():
        if _has_index(MIX_CATEGORY_TABLE, "ix_mix_category_category_id"):
            op.drop_index("ix_mix_category_category_id", table_name=MIX_CATEGORY_TABLE)
        op.drop_table(MIX_CATEGORY_TABLE)

    if MIX_TABLE in inspector.get_table_names():
        if _has_index(MIX_TABLE, "ix_mixes_artist_id"):
            op.drop_index("ix_mixes_artist_id", table_name=MIX_TABLE)
        if _has_index(MIX_TABLE, "ix_mixes_title"):
            op.drop_index("ix_mixes_title", table_name=MIX_TABLE)
        if _has_index(MIX_TABLE, "ix_mixes_id"):
            op.drop_index("ix_mixes_id", table_name=MIX_TABLE)
        op.drop_table(MIX_TABLE)

    if CATEGORY_TABLE in inspector.get_table_names():
        if _has_index(CATEGORY_TABLE, "ix_categories_name"):
            op.drop_index("ix_categories_name", table_name=CATEGORY_TABLE)
        if _has_index(CATEGORY_TABLE, "ix_categories_id"):
            op.drop_index("ix_categories_id", table_name=CATEGORY_TABLE)
        op.drop_table(CATEGORY_TABLE)

    if ARTIST_TABLE in inspector.get_table_names():
        if _has_index(ARTIST_TABLE, "ix_artists_name"):
            op.drop_index("ix_artists_name", table_name=ARTIST_TABLE)
        if _has_index(ARTIST_TABLE, "ix_artists_id"):
            op.drop_index("ix_artists_id", table_name=ARTIST_TABLE)
        op.drop_table(ARTIST_TABLE)
