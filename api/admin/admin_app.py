from sqladmin import Admin, ModelView
from .models import JobLink, Mp4List
from .database import sync_engine

def init_admin(app):
    """
    Initialize SQLAdmin on the given FastAPI app.
    """
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
        column_searchable_list = [JobLink.company_name, JobLink.position, JobLink.location]
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
