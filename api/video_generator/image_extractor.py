from pathlib import Path
import subprocess
import shutil

BASE_DIR = Path(__file__).resolve().parent.parent.parent
PPT_FILES_DIR = Path(BASE_DIR, 'n8n_files', 'ppt_files')
PDF_FILES_DIR = Path(BASE_DIR, 'n8n_files', 'pdf_files')
SLIDE_IMG_FILES_DIR = Path(BASE_DIR, 'n8n_files', 'ppt_images')
IMG_VIDEO_FILES_DIR = Path(BASE_DIR, 'n8n_files', 'img_video_files')

class ImageExtractor:
    """
    A singleton class responsible for extracting slide images from PowerPoint
    presentations. It manages job states, converts PPTX files to PDF using
    LibreOffice, and then extracts individual slide images using `pdftoppm`.
    """

    _instance = None
    job_store = {}

    def __new__(cls, *args, **kwargs):
        """
        Ensures that only one instance of ImageExtractor exists.

        Returns:
            A singleton instance of the class.
        """
        if not cls._instance:
            cls._instance = super(ImageExtractor, cls).__new__(cls, *args, **kwargs)
            cls._instance.connection = "Image Extractor"
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

    def extract_slides(self, file_name, total_slides, batch_size=-1):
        """
        Extract slides from a PowerPoint presentation and store them as PNG
        images. Uses LibreOffice to convert PPTX to PDF, then extracts slides
        using pdftoppm.

        Args:
            file_name (str): The base name of the PowerPoint file (without
                extension).
            total_slides (int): The total number of slides in the presentation.
            batch_size (int, optional): The number of slides to extract per
                batch. Defaults to -1 (all slides).

        Side Effects:
            - Generates slide images and stores them in SLIDE_IMG_FILES_DIR.
            - Updates job_store with job status and slide list.
            - Deletes intermediate PPTX and PDF files after processing.

        Job Store Updates:
            On success:
                {
                    "status": "completed",
                    "slides": [list of slide image file names]
                }
            On failure:
                {
                    "status": "failed",
                    "error": "<error message>"
                }
        """
        try:
            if SLIDE_IMG_FILES_DIR.exists():
                shutil.rmtree(SLIDE_IMG_FILES_DIR)
            SLIDE_IMG_FILES_DIR.mkdir(parents=True, exist_ok=True)
            PDF_FILES_DIR.mkdir(parents=True, exist_ok=True)

            ppt_path = Path(PPT_FILES_DIR, f"{file_name}.pptx")
            pdf_path = Path(PDF_FILES_DIR, f"{file_name}.pdf")

            subprocess.run([
                "libreoffice", "--headless", "--convert-to", "pdf",
                "--outdir", str(PDF_FILES_DIR),
                str(ppt_path)
            ], check=True)

            if batch_size == -1:
                subprocess.run([
                    "pdftoppm", str(pdf_path),
                    str(SLIDE_IMG_FILES_DIR / "slide"), "-png"
                ], check=True)

                slides = [file_path.name for file_path in sorted(SLIDE_IMG_FILES_DIR.glob("*.png"))]
            else:
                mp4_files = list(Path(IMG_VIDEO_FILES_DIR).glob("slide*.mp4"))
                start_slide = len(mp4_files) + 1
                end_slide = len(mp4_files) + batch_size
                end_slide = total_slides if end_slide > total_slides else end_slide

                if (start_slide <= total_slides):
                    subprocess.run([
                        "pdftoppm", str(pdf_path),
                        str(SLIDE_IMG_FILES_DIR / "slide"), "-png",
                        "-f", f"{start_slide}",
                        "-l", f"{end_slide}"
                    ], check=True)

                    slides = [file_path.name for file_path in sorted(SLIDE_IMG_FILES_DIR.glob("*.png"))]
                else:
                    pad_width = len(str(total_slides))
                    slides = [f"slide-{str(index).zfill(pad_width)}.png" for index in range(1, total_slides + 1)]

            if ppt_path.exists():
                ppt_path.unlink()

            if pdf_path.exists():
                pdf_path.unlink()

            self.job_store[file_name] = {
                "status": "completed",
                "slides": slides
            }

        except subprocess.CalledProcessError as e:
            self.job_store[file_name] = {
                "status": "failed",
                "error": f"Conversion failed: {e}"
            }
        except Exception as e:
            self.job_store[file_name] = {
                "status": "failed",
                "error": str(e)
            }

if __name__ == '__main__':
    img_extractor = ImageExtractor('0cdd9e6c-4982-4ff2-87b1-15a7684af373')
    print(img_extractor.extract_slides())