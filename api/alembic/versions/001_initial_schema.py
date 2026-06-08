"""initial schema

Revision ID: 001
Revises:
Create Date: 2026-05-19

"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "001"
down_revision: str | Sequence[str] | None = None
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.execute("CREATE SCHEMA IF NOT EXISTS job_listing")

    op.create_table(
        "job_links",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("company_name", sa.String(255)),
        sa.Column("position", sa.String(255)),
        sa.Column("location", sa.String(255)),
        sa.Column("date", sa.Date()),
        sa.Column("experience_required", sa.Text()),
        sa.Column("skills_required", sa.Text()),
        sa.Column("job_type", sa.Text()),
        sa.Column("link", sa.Text()),
        sa.Column("audio_added", sa.Boolean(), server_default="false"),
        sa.Column("audio_file_name", sa.String(255)),
        sa.Column("script_added", sa.Boolean(), server_default="false"),
        sa.Column("script", sa.Text()),
        sa.Column("video_created", sa.Boolean(), server_default="false"),
        schema="job_listing",
    )

    op.create_table(
        "mp4_list",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("date", sa.Date()),
        sa.Column("epoch", sa.BigInteger()),
        sa.Column("pages_scrapped", sa.BigInteger()),
        sa.Column("start_time", sa.Time()),
        sa.Column("end_time", sa.Time()),
        sa.Column("mp4_name", sa.String(255)),
        sa.Column("mp4_path", sa.Text()),
        sa.Column("execution_id", sa.Integer()),
        sa.Column("status", sa.String(50)),
        sa.Column("job_id", sa.Integer()),
        sa.Column("num_of_jobs", sa.Integer()),
        sa.Column("video_type", sa.String(50)),
        schema="job_listing",
    )


def downgrade() -> None:
    op.drop_table("mp4_list", schema="job_listing")
    op.drop_table("job_links", schema="job_listing")
    op.execute("DROP SCHEMA IF EXISTS job_listing")
