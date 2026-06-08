import asyncio
import json
import os
from contextlib import asynccontextmanager

import httpx
from markupsafe import Markup, escape
from sqladmin import Admin, BaseView, ModelView, expose
from sqladmin.authentication import AuthenticationBackend, login_required
from sqladmin.filters import AllUniqueStringValuesFilter
from sqlalchemy import func
from sqlalchemy import select as sa_select
from sqlalchemy.orm import Session
from starlette.requests import Request

from .database import async_engine, sync_engine
from .models import JobLink, Mp4List

_ADMIN_API_URL = os.getenv("ADMIN_API_URL", "http://admin-api:8080")
_INTERNAL_SECRET = os.getenv("INTERNAL_SECRET", "")

# Fields too large / irrelevant to include in audit detail
_SKIP_AUDIT_FIELDS = {
    "job_description",
    "script",
    "experience_required",
    "skills_required",
    "audio_file_name",
    "script_added",
}


def _model_snapshot(model) -> str:
    """Compact JSON of a model's non-large fields."""
    data = {
        k: v
        for k, v in vars(model).items()
        if not k.startswith("_") and k not in _SKIP_AUDIT_FIELDS
    }
    return json.dumps(data, default=str)


def _diff_snapshot(model, new_data: dict) -> str | None:
    """Compact JSON of changed fields: {field: {from: old, to: new}}."""
    changes = {}
    for key, new_val in new_data.items():
        if key in _SKIP_AUDIT_FIELDS:
            continue
        old_val = getattr(model, key, None)
        if old_val != new_val:
            changes[key] = {"from": old_val, "to": new_val}
    return json.dumps(changes, default=str) if changes else None


def _audit(
    action: str,
    target: str | None = None,
    detail: str | None = None,
    ip_address: str | None = None,
) -> None:
    """Fire-and-forget audit event to admin-api.

    Swallows all exceptions intentionally — audit failures must never block
    SQLAdmin model saves/deletes.
    """
    if not _INTERNAL_SECRET:
        return

    async def _post():
        try:
            async with httpx.AsyncClient(timeout=3) as client:
                await client.post(
                    f"{_ADMIN_API_URL}/internal/audit",
                    json={
                        "action": action,
                        "actor_name": "sqladmin",
                        "target_name": target,
                        "detail": detail,
                        "ip_address": ip_address,
                    },
                    headers={"X-Internal-Secret": _INTERNAL_SECRET},
                )
        except Exception:
            pass

    try:
        loop = asyncio.get_event_loop()
        if loop.is_running():
            asyncio.ensure_future(_post())
        else:
            loop.run_until_complete(_post())
    except Exception:
        pass


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
            "environment": os.getenv(
                "APP_ENV", os.getenv("ENVIRONMENT", "development")
            ),
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
                count = session.scalar(
                    sa_select(func.count()).select_from(view.model)
                )
                stats.append(
                    {
                        "name": view.name,
                        "icon": getattr(view, "icon", "fa-solid fa-table"),
                        "count": count,
                        "identity": view.identity,
                    }
                )
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
    from sqladmin.filters import get_column_obj
    from sqlalchemy.orm import Session

    model = getattr(filter_obj.column, "class_", None)
    column_obj = get_column_obj(filter_obj.column, model)
    with Session(sync_engine) as session:
        rows = session.execute(
            sa_select(column_obj).distinct().order_by(column_obj.desc())
        ).all()
        return [str(r[0]) for r in rows if r[0] is not None]


def _remove_filter_value(request, param_name, value_to_remove):
    current = request.query_params.get(param_name, "")
    remaining = [
        v.strip()
        for v in current.split(",")
        if v.strip() and v.strip() != value_to_remove
    ]
    if remaining:
        return str(
            request.url.include_query_params(
                **{param_name: ",".join(remaining)}
            )
        )
    return str(request.url.remove_query_params(param_name))


def init_admin(app):
    @asynccontextmanager
    async def lifespan(app):
        yield
        await async_engine.dispose()

    app.router.lifespan_context = lifespan

    # Create Admin instance
    auth_backend = AdminAuth(
        secret_key=os.getenv("ADMIN_SECRET_KEY", "change-me-in-production")
    )
    admin = CustomAdmin(
        app,
        sync_engine,
        base_url="/db-admin",
        templates_dir=_TEMPLATES_DIR,
        authentication_backend=auth_backend,
    )

    # Expose a url_for that includes the app's root_path prefix so nginx routes it correctly
    _root = app.root_path
    admin.templates.env.globals["main_url_for"] = (
        lambda name, **kw: _root + str(app.url_path_for(name, **kw))
    )
    admin.templates.env.globals["admin_logout_url"] = (
        _root + "/db-admin/logout"
    )
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
        column_filters = [
            MultiValueFilter(JobLink.date),
            AllUniqueStringValuesFilter(JobLink.video_type),
        ]
        column_formatters_detail = {
            "skills_required": lambda m, _: Markup(
                '<div style="white-space: pre-wrap; max-width: 100%">{}</div>'
            ).format(escape(m.skills_required or "")),
            "job_description": lambda m, _: Markup(
                '<div style="white-space: pre-wrap; max-width: 100%">{}</div>'
            ).format(escape(m.job_description or "")),
            "script": lambda m, _: Markup(
                '<div style="white-space: pre-wrap; max-width: 100%">{}</div>'
            ).format(escape(m.script or "")),
        }

        async def on_model_change(self, data, model, is_created, request):
            if not is_created:
                request.state.joblink_diff = _diff_snapshot(model, data)

        async def after_model_change(self, data, model, is_created, request):
            ip = request.client.host if request.client else None
            detail = (
                _model_snapshot(model)
                if is_created
                else getattr(request.state, "joblink_diff", None)
            )
            _audit(
                "create" if is_created else "update",
                target=f"joblink#{model.id}",
                detail=detail,
                ip_address=ip,
            )

        async def after_model_delete(self, model, request):
            ip = request.client.host if request.client else None
            _audit(
                "delete",
                target=f"joblink#{model.id}",
                detail=_model_snapshot(model),
                ip_address=ip,
            )

    # Mp4List admin
    class Mp4ListAdmin(ModelView, model=Mp4List):
        icon = "fa-solid fa-film"
        column_exclude_list = [
            Mp4List.mp4_path,
        ]
        column_searchable_list = [Mp4List.mp4_name, Mp4List.status]
        column_sortable_list = [Mp4List.date, Mp4List.id]
        column_filters = [
            MultiValueFilter(Mp4List.date),
            AllUniqueStringValuesFilter(Mp4List.video_type),
        ]

        async def on_model_change(self, data, model, is_created, request):
            if not is_created:
                request.state.mp4_diff = _diff_snapshot(model, data)

        async def after_model_change(self, data, model, is_created, request):
            ip = request.client.host if request.client else None
            detail = (
                _model_snapshot(model)
                if is_created
                else getattr(request.state, "mp4_diff", None)
            )
            _audit(
                "create" if is_created else "update",
                target=f"mp4#{model.id}",
                detail=detail,
                ip_address=ip,
            )

        async def after_model_delete(self, model, request):
            ip = request.client.host if request.client else None
            _audit(
                "delete",
                target=f"mp4#{model.id}",
                detail=_model_snapshot(model),
                ip_address=ip,
            )

    # Register views
    admin.add_view(JobLinkAdmin)
    admin.add_view(Mp4ListAdmin)
    admin.add_view(SettingsView)
