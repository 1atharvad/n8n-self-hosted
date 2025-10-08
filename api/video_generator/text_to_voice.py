from pydantic import BaseModel
from pathlib import Path
import numpy as np
import uuid
import re
from tqdm import tqdm
import subprocess
from kokoro_onnx import Kokoro
import soundfile as sf

BASE_DIR = Path(__file__).resolve().parent.parent.parent
FILES_DIR = Path(BASE_DIR, "n8n_files", "audio_files")

model_path = Path(BASE_DIR, "tts_cache", "kokoro-v1.0.onnx")
voices_path = Path(BASE_DIR, "tts_cache", "voices-v1.0.bin")

class TTSRequest(BaseModel):
    """
    Pydantic model representing a Text-to-Speech (TTS) request.

    Attributes:
        text (str): The input text to be converted into speech.
    """
    text: str

class TextToVoice:
    """
    A singleton class for generating speech audio files from text using TTS.

    Responsibilities:
        - Manage TTS jobs with status tracking.
        - Split long text into smaller chunks for processing.
        - Generate speech audio and save it as a `.wav` file.
    """

    _instance = None
    job_store = {}

    def __new__(cls, *args, **kwargs):
        """
        Ensures only one instance of TextToVoice exists.

        Returns:
            Singleton instance of the class.
        """
        if not cls._instance:
            cls._instance = super(TextToVoice, cls).__new__(cls, *args, **kwargs)
            cls._instance.connection = "Text To Voice"
            cls._instance.download_required_files()
            cls._instance.kokoro_tts = Kokoro(model_path=str(model_path), voices_path=str(voices_path))
        return cls._instance

    @staticmethod
    def download_with_progress(url, destination_path: Path):
        """
        Downloads a file from a given URL to a specified destination path while
        displaying a progress bar.

        The method ensures that the destination directory exists, then uses
        `wget` to download the file. A progress bar is displayed using `tqdm`
        and updates based on the percentage output from `wget`.

        Args:
            url (str): The URL to download the file from.
            destination_path (Path): Full path where the file should be saved.

        Side Effects:
            - Creates the destination directory if it does not exist.
            - Displays a console progress bar during download.
            - Prints success or error messages to the console.

        Raises:
            FileNotFoundError: If the `wget` command is not available.
            Exception: For any other errors that occur during download.
        """
        dir_path = destination_path.parent

        if not dir_path.exists():
            dir_path.mkdir(parents=True, exist_ok=True)

        cmd = [
            "wget", "--progress=bar:force:noscroll", "-O",
            destination_path, url
        ]

        try:
            with subprocess.Popen(
                cmd,
                stdout=subprocess.PIPE,
                stderr=subprocess.STDOUT,
                text=True,
                bufsize=1
            ) as process:
                progress_pattern = re.compile(r'\s*(\d+)%\s*')
                progress_bar = tqdm(
                    total=100,
                    unit='%',
                    desc=f'Downloading {destination_path.name}'
                )

                for line in process.stdout:
                    match = progress_pattern.search(line)
                    if match:
                        current_percent = int(match.group(1))
                        progress_bar.n = current_percent
                        progress_bar.refresh()

                progress_bar.close()
                process.wait()
            print(f"✅ Download complete: {destination_path}\n")
        except FileNotFoundError:
            print("Error: `wget` command not found. Please ensure it is installed.")
        except Exception as e:
            print(f"An error occurred: {e}")

    def download_required_files(self):
        """
        Ensure that the required TTS model files exist locally, and download
        any missing files.

        The method checks for the presence of essential files
        (`kokoro-v1.0.onnx` and `voices-v1.0.bin`) in the local `tts_cache`
        directory. If any files are missing, it downloads them using the
        `download_with_progress` method and displays a progress bar for each
        download.

        Side Effects:
            - Creates directories for storing model files if they do not exist.
            - Downloads missing files from their respective URLs.
            - Prints information about missing files and download progress to
                the console.

        Required Files:
            1. `kokoro-v1.0.onnx` - TTS model file
            2. `voices-v1.0.bin` - Voice configuration file
        """
        required_files = [
            {
                'file_name': 'kokoro-v1.0.onnx',
                'file_path': Path(BASE_DIR, "tts_cache", "kokoro-v1.0.onnx"),
                'download_url': "https://github.com/nazdridoy/kokoro-tts/releases/download/v1.0.0/kokoro-v1.0.onnx",
            },
            {
                'file_name': 'voices-v1.0.bin',
                'file_path': Path(BASE_DIR, "tts_cache", "voices-v1.0.bin"),
                'download_url': "https://github.com/nazdridoy/kokoro-tts/releases/download/v1.0.0/voices-v1.0.bin"
            }
        ]

        missing_files = []
        for _file in required_files:
            if not _file.get('file_path').exists():
                missing_files.append(_file)

        if missing_files:
            print("Required model files which are missing:")
            for _file in missing_files:
                print(f"  • {_file.get('file_name')}")
            print('')
            for _file in missing_files:
                self.download_with_progress(
                    _file.get('download_url'),
                    _file.get('file_path')
                )

    def get_job(self, job_id: str):
        """
        Retrieves job metadata by job ID.

        Args:
            job_id (str): Unique identifier of the TTS job.

        Returns:
            Job details if available, otherwise None.
        """
        return self.job_store.get(job_id)

    def set_job_status(self, job_id='', status='pending'):
        """
        Initializes or updates the status of a TTS job.
        If no job_id is provided, a new one is generated.

        Args:
            job_id (str, optional): Unique identifier of the TTS job. Defaults
                to '' (new UUID generated).
            status (str, optional): Job status. Defaults to 'pending'.

        Returns:
            Job ID and its updated metadata dictionary.
        """
        if job_id == '':
            job_id = str(uuid.uuid4())
        if job_id not in self.job_store:
            self.job_store[job_id] = {}
        self.job_store[job_id]["status"] = status
        return job_id, self.job_store.get(job_id)

    @staticmethod
    def chunk_text(text, max_len=300):
        """
        Splits long text into smaller chunks suitable for TTS processing.

        The method tries to break text by punctuation (., !, ?).
        If a chunk exceeds the maximum length, it creates a new one.

        Args:
            text (str): The input text to split.
            max_len (int, optional): Maximum character length per chunk.
                Defaults to 300.

        Returns:
            A list of text chunks.
        """
        sentences = re.split(r'(?<=[.!?])\s+', text)
        chunks, current = [], ""
        for s in sentences:
            if len(current) + len(s) < max_len:
                current += " " + s
            else:
                if current:
                    chunks.append(current.strip())
                current = s
        if current:
            chunks.append(current.strip())
        return chunks

    def generate_tts_job(self, job_id: str, text: str):
        """
        Generates a speech audio file from text using the TTS engine.

        The method splits long text into chunks, synthesizes audio for each
        chunk, concatenates them, and writes the final `.wav` file to disk.
        Updates job metadata with the result.

        Args:
            job_id (str): Unique identifier of the TTS job.
            text (str): Input text to convert to speech.

        Side Effects:
            - Creates a `.wav` audio file inside FILES_DIR.
            - Updates job_store with job status and file path.

        Job Store Structure:
            {
                "status": "completed" | "failed",
                "file_path": "<path/to/audio.wav>" | None,
                "error": "<error message>" (if failed)
            }
        """
        try:
            file_path = Path(FILES_DIR, f"{job_id}.wav")

            audio_segments = []
            sr = None
            for chunk in self.chunk_text(text):
                audio, sr = self.kokoro_tts.create(chunk, voice="am_michael")
                audio_segments.append(audio)

            final_audio = np.concatenate(audio_segments)
            sf.write(str(file_path), final_audio, sr)

            self.job_store[job_id] = {
                "status": "completed",
                "file_path": str(file_path)
            }

        except Exception as e:
            self.job_store[job_id] = {
                "status": "failed",
                "error": str(e)
            }


if __name__ == '__main__':
    tts_service = TextToVoice()

    job_id, _ = tts_service.set_job_status('kokoro_test')
    tts_service.generate_tts_job(job_id, "Hello, this is Kokoro speaking. I am an AI agent, how can I help you Atharva?")
    print("Kokoro job:", tts_service.get_job(job_id))