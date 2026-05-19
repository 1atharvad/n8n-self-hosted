import os
import urllib.parse
from logging.config import fileConfig

from alembic import context
from sqlalchemy import create_engine, pool

from admin.models import Base

config = context.config

if config.config_file_name is not None:
    fileConfig(config.config_file_name)

target_metadata = Base.metadata

_user = os.environ["POSTGRES_USER"]
_password = urllib.parse.quote_plus(os.environ["POSTGRES_PASSWORD"])
_db = os.environ["POSTGRES_DB"]
_port = os.environ.get("POSTGRES_PORT", "5432")
_host = os.environ.get("POSTGRES_HOST", "postgres")

DB_URL = f"postgresql+psycopg2://{_user}:{_password}@{_host}:{_port}/{_db}"

TARGET_SCHEMAS = {"job_listing"}


def include_object(obj, name, type_, reflected, compare_to):
    if type_ == "table":
        return obj.schema in TARGET_SCHEMAS
    return True


def run_migrations_offline() -> None:
    context.configure(
        url=DB_URL,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
        include_schemas=True,
        include_object=include_object,
    )
    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    connectable = create_engine(DB_URL, poolclass=pool.NullPool)
    with connectable.connect() as connection:
        context.configure(
            connection=connection,
            target_metadata=target_metadata,
            include_schemas=True,
            include_object=include_object,
        )
        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
