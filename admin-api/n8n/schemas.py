from pydantic import BaseModel


class FolderBody(BaseModel):
    name: str


class AssignFolderBody(BaseModel):
    folder_id: str
