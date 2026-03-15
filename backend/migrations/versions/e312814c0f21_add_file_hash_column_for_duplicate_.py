"""Add file_hash column for duplicate detection

Revision ID: e312814c0f21
Revises: 1f6b9e3c4d2a
Create Date: 2025-08-05 17:14:36.999861

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'e312814c0f21'
down_revision: Union[str, Sequence[str], None] = '1f6b9e3c4d2a'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


FILE_HASH_INDEX = "ix_mixes_file_hash"


def upgrade() -> None:
    """Upgrade schema."""
    with op.batch_alter_table("mixes") as batch_op:
        batch_op.add_column(sa.Column("file_hash", sa.String(length=64), nullable=True))
        batch_op.create_index(FILE_HASH_INDEX, ["file_hash"], unique=False)


def downgrade() -> None:
    """Downgrade schema."""
    with op.batch_alter_table("mixes") as batch_op:
        batch_op.drop_index(FILE_HASH_INDEX)
        batch_op.drop_column("file_hash")
