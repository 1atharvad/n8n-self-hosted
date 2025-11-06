import os
from pathlib import Path

import paramiko
from scp import SCPClient

# Server details
HOST = os.getenv("OBS_HOST")
USERNAME = os.getenv("OBS_SERVER_USERNAME")
PASSWORD = os.getenv("OBS_SERVER_PASSWORD")
REMOTE_PATH = os.getenv("OBS_REMOTE_PATH")

BASE_DIR = Path(__file__).resolve().parent.parent.parent
VIDEO_FILE_DIR = Path(BASE_DIR, 'n8n_files', 'video_files')


class ServerFileManagement:
    _instance = None
    job_store = {}

    def __new__(cls, *args, **kwargs):
        if not cls._instance:
            cls._instance = super().__new__(cls, *args, **kwargs)
            cls._instance.connection = "File Upload"
        return cls._instance

    def get_job(self, job_id: str):
        """
        Retrieves job metadata by job ID.

        Args:
            job_id (str): The unique identifier of the job.

        Returns:
            Job details if found, otherwise None.
        """
        return self.job_store.get(job_id)

    def set_job_status(self, job_id, status='pending'):
        """
        Sets or updates the status of a job.

        Args:
            job_id (str): The unique identifier of the job.
            status (str, optional): The job status (default is "pending").

        Returns:
            Job ID and its metadata dictionary.
        """
        if job_id not in self.job_store:
            self.job_store[job_id] = {}
        self.job_store[job_id]["status"] = status
        return job_id, self.job_store.get(job_id)

    @staticmethod
    def connect_to_ssh():
        ssh = paramiko.SSHClient()
        ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
        ssh.connect(HOST, username=USERNAME, password=PASSWORD)

        return ssh

    def upload_video_via_ssh(self, folder_name: str, local_filename: str):
        try:
            local_file = Path(VIDEO_FILE_DIR, f"{local_filename}.mp4")

            if not local_file.exists():
                raise FileNotFoundError(f"Local file not found: {local_file}")

            print(
                f"📁 Uploading {local_filename}.mp4 → {HOST}:{REMOTE_PATH}",
                flush=True,
            )

            ssh = self.connect_to_ssh()
            sftp = ssh.open_sftp()
            remote_folder = f"{REMOTE_PATH}/{folder_name}"
            try:
                sftp.stat(remote_folder)
            except FileNotFoundError:
                print(
                    f"📂 Remote folder not found, creating: {remote_folder}",
                    flush=True,
                )
                sftp.mkdir(remote_folder)

            sftp.close()

            with SCPClient(ssh.get_transport()) as scp:
                scp.put(str(local_file), remote_folder)
            ssh.close()

            print("✅ File uploaded successfully!", flush=True)

            self.job_store[local_filename] = {
                "status": "completed",
                "output": f"Uploaded {local_filename}.mp4 to {remote_folder}",
            }

        except Exception as e:
            self.job_store[local_filename] = {
                "status": "failed",
                "error": f"❌ Upload failed: {e}",
            }

    def delete_remote_file(self, job_id, folder_name: str, filename: str):
        ssh = self.connect_to_ssh()
        remote_file = f"{REMOTE_PATH}/{folder_name}/{filename}"
        try:
            sftp = ssh.open_sftp()
            try:
                sftp.stat(remote_file)
                sftp.remove(remote_file)
                print(f"✅ Deleted remote file: {remote_file}", flush=True)
                self.job_store[job_id] = {
                    "status": "completed",
                    "output": f"Deleted {remote_file}",
                }
            except FileNotFoundError:
                self.job_store[job_id] = {
                    "status": "failed",
                    "error": f"❌ File not found: {remote_file}",
                }
            finally:
                sftp.close()
        except Exception as e:
            self.job_store[job_id] = {
                "status": "failed",
                "error": f"❌ Delete failed: {e}",
            }
        finally:
            ssh.close()
