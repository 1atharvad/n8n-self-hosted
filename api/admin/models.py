from sqlalchemy import (
    BigInteger,
    Boolean,
    Column,
    Date,
    Integer,
    String,
    Text,
    Time,
)
from sqlalchemy.orm import declarative_base

Base = declarative_base()


class JobLink(Base):
    __tablename__ = "job_links"
    __table_args__ = {"schema": "job_listing"}

    id = Column(Integer, primary_key=True)
    company_name = Column(String(255))
    position = Column(String(255))
    location = Column(String(255))
    date = Column(Date)
    experience_required = Column(Text)
    skills_required = Column(Text)
    job_type = Column(Text)
    link = Column(Text)
    audio_added = Column(Boolean, default=False)
    audio_file_name = Column(String(255))
    script_added = Column(Boolean, default=False)
    script = Column(Text)
    video_created = Column(Boolean, default=False)


class Mp4List(Base):
    __tablename__ = "mp4_list"
    __table_args__ = {"schema": "job_listing"}

    id = Column(Integer, primary_key=True)
    date = Column(Date)
    epoch = Column(BigInteger)
    pages_scrapped = Column(BigInteger)
    start_time = Column(Time)
    end_time = Column(Time)
    mp4_name = Column(String(255))
    mp4_path = Column(Text)
