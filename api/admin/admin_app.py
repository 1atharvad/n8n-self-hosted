from contextlib import asynccontextmanager

from markupsafe import Markup
from sqladmin import Admin, ModelView

from .database import async_engine, sync_engine
from .models import JobLink, Mp4List


def init_admin(app):
    @asynccontextmanager
    async def lifespan(app):
        yield
        await async_engine.dispose()

    app.router.lifespan_context = lifespan

    # Create Admin instance
    admin = Admin(app, sync_engine, base_url="/db-admin")

    # JobLink admin
    class JobLinkAdmin(ModelView, model=JobLink):
        column_exclude_list = [
            JobLink.experience_required,
            JobLink.skills_required,
            JobLink.job_type,
            JobLink.job_description,
            JobLink.link,
            JobLink.audio_file_name,
            JobLink.script_added,
            JobLink.script,
        ]
        column_searchable_list = [
            JobLink.company_name,
            JobLink.position,
            JobLink.location,
        ]
        column_sortable_list = [JobLink.date, JobLink.id]
        column_filters = [JobLink.date, JobLink.video_type]
        column_formatters_detail = {
            "skills_required": lambda m, _: Markup(f'<div style="white-space: pre-wrap; max-width: 100%">{m.skills_required or ""}</div>'),
            "job_description": lambda m, _: Markup(f'<div style="white-space: pre-wrap; max-width: 100%">{m.job_description or ""}</div>'),
            "script": lambda m, _: Markup(f'<div style="white-space: pre-wrap; max-width: 100%">{m.script or ""}</div>'),
        }

    # Mp4List admin
    class Mp4ListAdmin(ModelView, model=Mp4List):
        column_exclude_list = [
            Mp4List.mp4_path,
        ]
        column_sortable_list = [Mp4List.date, Mp4List.id]
        column_filters = [Mp4List.date, Mp4List.video_type]

    # Register views
    admin.add_view(JobLinkAdmin)
    admin.add_view(Mp4ListAdmin)
