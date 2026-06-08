import os

from minio import Minio

MINIO_ENDPOINT = (
    os.environ.get("MINIO_ENDPOINT", "http://minio:9000")
    .replace("http://", "")
    .replace("https://", "")
)
MINIO_ACCESS_KEY = os.environ.get("MINIO_ROOT_USER", "minioadmin")
MINIO_SECRET_KEY = os.environ.get("MINIO_ROOT_PASSWORD", "")
MINIO_BUCKET = os.environ.get("MINIO_BUCKET_NAME", "n8n-binary-data")
MINIO_SECURE = os.environ.get("MINIO_ENDPOINT", "").startswith("https")

client = Minio(
    MINIO_ENDPOINT,
    access_key=MINIO_ACCESS_KEY,
    secret_key=MINIO_SECRET_KEY,
    secure=MINIO_SECURE,
)


def ensure_bucket() -> None:
    if not client.bucket_exists(MINIO_BUCKET):
        client.make_bucket(MINIO_BUCKET)


def upload_file(
    object_name: str,
    file_path: str,
    content_type: str = "application/octet-stream",
) -> str:
    ensure_bucket()
    client.fput_object(
        MINIO_BUCKET, object_name, file_path, content_type=content_type
    )
    return object_name


def upload_bytes(
    object_name: str,
    data: bytes,
    content_type: str = "application/octet-stream",
) -> str:
    import io

    ensure_bucket()
    client.put_object(
        MINIO_BUCKET,
        object_name,
        io.BytesIO(data),
        length=len(data),
        content_type=content_type,
    )
    return object_name


def download_file(object_name: str, dest_path: str) -> None:
    client.fget_object(MINIO_BUCKET, object_name, dest_path)


def get_presigned_url(object_name: str, expires_hours: int = 24) -> str:
    from datetime import timedelta

    return client.presigned_get_object(
        MINIO_BUCKET, object_name, expires=timedelta(hours=expires_hours)
    )


def delete_file(object_name: str) -> None:
    client.remove_object(MINIO_BUCKET, object_name)


def list_files(prefix: str = "") -> list[str]:
    objects = client.list_objects(MINIO_BUCKET, prefix=prefix, recursive=True)
    return [obj.object_name for obj in objects]
