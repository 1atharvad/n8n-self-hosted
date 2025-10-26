from contextlib import asynccontextmanager

from sqladmin import Admin, ModelView
from sqlalchemy import text

from .database import async_engine, sync_engine
from .models import Base, JobLink, Mp4List


def init_admin(app):
    """
    Initialize SQLAdmin on the given FastAPI app.
    """

    @asynccontextmanager
    async def lifespan(app):
        # ---- Startup ----
        async with async_engine.begin() as conn:
            await conn.execute(text("CREATE SCHEMA IF NOT EXISTS job_listing"))
            await conn.run_sync(Base.metadata.create_all)
        yield
        # ---- Shutdown ----
        await async_engine.dispose()

    # Attach the lifespan handler
    app.router.lifespan_context = lifespan

    # Create Admin instance
    admin = Admin(app, sync_engine)

    # JobLink admin
    class JobLinkAdmin(ModelView, model=JobLink):
        column_list = [
            JobLink.id,
            JobLink.company_name,
            JobLink.position,
            JobLink.location,
            JobLink.date,
            JobLink.skills_required,
            JobLink.audio_added,
            JobLink.video_created,
        ]
        column_searchable_list = [
            JobLink.company_name,
            JobLink.position,
            JobLink.location,
        ]
        column_sortable_list = [JobLink.date, JobLink.id]

    # Mp4List admin
    class Mp4ListAdmin(ModelView, model=Mp4List):
        column_list = [
            Mp4List.id,
            Mp4List.date,
            Mp4List.pages_scrapped,
            Mp4List.start_time,
            Mp4List.end_time,
            Mp4List.mp4_name,
        ]
        column_sortable_list = [Mp4List.date, Mp4List.id]

    # Register views
    admin.add_view(JobLinkAdmin)
    admin.add_view(Mp4ListAdmin)
