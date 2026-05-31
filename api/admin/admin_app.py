import os
from contextlib import asynccontextmanager

from markupsafe import Markup, escape
from sqladmin import Admin, BaseView, ModelView, expose
from sqladmin.authentication import AuthenticationBackend, login_required
from sqladmin.filters import AllUniqueStringValuesFilter
from sqlalchemy import func, select as sa_select
from sqlalchemy.orm import Session
from starlette.requests import Request

from .database import async_engine, sync_engine
from .models import JobLink, Mp4List


class AdminAuth(AuthenticationBackend):
    async def login(self, request: Request) -> bool:
        form = await request.form()
        username = form.get("username", "")
        password = form.get("password", "")
        expected_user = os.getenv("ADMIN_USERNAME", "admin")
        expected_pass = os.getenv("ADMIN_PASSWORD", "")
        if not expected_pass:
            return False
        if username == expected_user and password == expected_pass:
            request.session.update({"admin_auth": True})
            return True
        return False

    async def logout(self, request: Request) -> bool:
        request.session.clear()
        return True

    async def authenticate(self, request: Request) -> bool:
        return request.session.get("admin_auth", False)


class SettingsView(BaseView):
    name = "Settings"
    icon = "fa-solid fa-gear"

    @expose("/settings", methods=["GET"])
    async def settings_page(self, request: Request):
        import sys
        from importlib.metadata import version as pkg_version

        db_info = {
            "host": os.getenv("POSTGRES_HOST", "postgres"),
            "port": os.getenv("POSTGRES_PORT", "5432"),
            "database": os.getenv("POSTGRES_DB", "—"),
            "username": os.getenv("POSTGRES_USER", "—"),
        }

        info = {
            "python_version": sys.version.split()[0],
            "environment": os.getenv("APP_ENV", os.getenv("ENVIRONMENT", "development")),
            "sqladmin_version": pkg_version("sqladmin"),
            "db": db_info,
        }
        return await self.templates.TemplateResponse(
            request, "sqladmin/settings.html", {"info": info}
        )


class CustomAdmin(Admin):
    @login_required
    async def index(self, request: Request):
        stats = []
        with Session(sync_engine) as session:
            for view in self._views:
                if not isinstance(view, ModelView):
                    continue
                count = session.scalar(sa_select(func.count()).select_from(view.model))
                stats.append({
                    "name": view.name,
                    "icon": getattr(view, "icon", "fa-solid fa-table"),
                    "count": count,
                    "identity": view.identity,
                })
        return await self.templates.TemplateResponse(
            request, "sqladmin/index.html", {"model_stats": stats}
        )

_TEMPLATES_DIR = os.path.join(os.path.dirname(__file__), "src", "templates")


class MultiValueFilter(AllUniqueStringValuesFilter):
    """Exact-match filter that supports multiple comma-separated values via column.in_()."""

    async def get_filtered_query(self, query, value, model):
        if not value:
            return query
        from sqladmin.filters import get_column_obj
        column_obj = get_column_obj(self.column, model)
        values = [v.strip() for v in value.split(",") if v.strip()]
        if not values:
            return query
        if len(values) == 1:
            return query.filter(column_obj == values[0])
        return query.filter(column_obj.in_(values))


def _get_filter_options(filter_obj):
    from sqlalchemy.orm import Session
    from sqladmin.filters import get_column_obj
    model = getattr(filter_obj.column, "class_", None)
    column_obj = get_column_obj(filter_obj.column, model)
    with Session(sync_engine) as session:
        rows = session.execute(sa_select(column_obj).distinct().order_by(column_obj.desc())).all()
        return [str(r[0]) for r in rows if r[0] is not None]


def _remove_filter_value(request, param_name, value_to_remove):
    current = request.query_params.get(param_name, "")
    remaining = [v.strip() for v in current.split(",") if v.strip() and v.strip() != value_to_remove]
    if remaining:
        return str(request.url.include_query_params(**{param_name: ",".join(remaining)}))
    return str(request.url.remove_query_params(param_name))


def init_admin(app):
    @asynccontextmanager
    async def lifespan(app):
        yield
        await async_engine.dispose()

    app.router.lifespan_context = lifespan

    # Create Admin instance
    auth_backend = AdminAuth(secret_key=os.getenv("ADMIN_SECRET_KEY", "change-me-in-production"))
    admin = CustomAdmin(app, sync_engine, base_url="/db-admin", templates_dir=_TEMPLATES_DIR, authentication_backend=auth_backend)

    # Expose a url_for that includes the app's root_path prefix so nginx routes it correctly
    _root = app.root_path
    admin.templates.env.globals["main_url_for"] = (
        lambda name, **kw: _root + str(app.url_path_for(name, **kw))
    )
    admin.templates.env.globals["admin_logout_url"] = _root + "/db-admin/logout"
    admin.templates.env.globals["remove_filter_value"] = _remove_filter_value
    admin.templates.env.globals["get_filter_options"] = _get_filter_options

    # JobLink admin
    class JobLinkAdmin(ModelView, model=JobLink):
        icon = "fa-solid fa-briefcase"
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
        column_filters = [MultiValueFilter(JobLink.date), AllUniqueStringValuesFilter(JobLink.video_type)]
        column_formatters_detail = {
            "skills_required": lambda m, _: Markup('<div style="white-space: pre-wrap; max-width: 100%">{}</div>').format(escape(m.skills_required or "")),
            "job_description": lambda m, _: Markup('<div style="white-space: pre-wrap; max-width: 100%">{}</div>').format(escape(m.job_description or "")),
            "script": lambda m, _: Markup('<div style="white-space: pre-wrap; max-width: 100%">{}</div>').format(escape(m.script or "")),
        }

    # Mp4List admin
    class Mp4ListAdmin(ModelView, model=Mp4List):
        icon = "fa-solid fa-film"
        column_exclude_list = [
            Mp4List.mp4_path,
        ]
        column_searchable_list = [Mp4List.mp4_name, Mp4List.status]
        column_sortable_list = [Mp4List.date, Mp4List.id]
        column_filters = [MultiValueFilter(Mp4List.date), AllUniqueStringValuesFilter(Mp4List.video_type)]

    # Register views
    admin.add_view(JobLinkAdmin)
    admin.add_view(Mp4ListAdmin)
    admin.add_view(SettingsView)
