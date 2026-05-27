"""add job_description and video_type to job_links

Revision ID: 002
Revises: 001
Create Date: 2026-05-27

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "002"
down_revision: Union[str, Sequence[str], None] = "001"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "job_links",
        sa.Column("job_description", sa.Text()),
        schema="job_listing",
    )
    op.add_column(
        "job_links",
        sa.Column("video_type", sa.String(50)),
        schema="job_listing",
    )


def downgrade() -> None:
    op.drop_column("job_links", "video_type", schema="job_listing")
    op.drop_column("job_links", "job_description", schema="job_listing")
