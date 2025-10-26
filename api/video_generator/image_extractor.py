import shutil
import subprocess
from pathlib import Path

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
            cls._instance = super().__new__(cls, *args, **kwargs)
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

    def extract_slides(self, file_name, start_slide, end_slide, total_slides):
        """
        Extract a range of slides from a PowerPoint presentation and save them
        as PNG images.

        This method converts a `.pptx` file to PDF using LibreOffice, then
        extracts slide images using `pdftoppm`. The resulting PNGs are stored
        in `SLIDE_IMG_FILES_DIR`. It supports extracting a specific slide range
        or the entire presentation.

        Args:
            file_name (str): Base name of the PowerPoint file (without
                extension).
            start_slide (int): Starting slide number (1-based, inclusive).
            end_slide (int): Ending slide number (1-based, inclusive).
                If `end_slide - start_slide <= 0`, all slides are extracted.
            total_slides (int): Total number of slides in the presentation.

        Side Effects:
            - Creates/clears `SLIDE_IMG_FILES_DIR` and `PDF_FILES_DIR`.
            - Generates slide images and saves them as `slide-<num>.png`.
            - Deletes the original PPTX and intermediate PDF after processing.
            - Updates `self.job_store[file_name]` with the extraction status.

        Job Store Updates:
            On success:
                {
                    "status": "completed",
                    "slides": [list of generated slide image filenames]
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

            subprocess.run(
                [
                    "libreoffice",
                    "--headless",
                    "--convert-to",
                    "pdf",
                    "--outdir",
                    str(PDF_FILES_DIR),
                    str(ppt_path),
                ],
                check=True,
            )

            if end_slide - start_slide < 0:
                subprocess.run(
                    [
                        "pdftoppm",
                        str(pdf_path),
                        str(SLIDE_IMG_FILES_DIR / "slide"),
                        "-png",
                    ],
                    check=True,
                )

                slides = [
                    file_path.name
                    for file_path in sorted(SLIDE_IMG_FILES_DIR.glob("*.png"))
                ]
            else:
                if start_slide <= total_slides:
                    subprocess.run(
                        [
                            "pdftoppm",
                            str(pdf_path),
                            str(SLIDE_IMG_FILES_DIR / "slide"),
                            "-png",
                            "-f",
                            f"{start_slide}",
                            "-l",
                            f"{end_slide}",
                        ],
                        check=True,
                    )

                    slides = [
                        file_path.name
                        for file_path in sorted(
                            SLIDE_IMG_FILES_DIR.glob("*.png")
                        )
                    ]
                else:
                    pad_width = len(str(total_slides))
                    slides = [
                        f"slide-{str(index).zfill(pad_width)}.png"
                        for index in range(1, total_slides + 1)
                    ]

            if ppt_path.exists():
                ppt_path.unlink()

            if pdf_path.exists():
                pdf_path.unlink()

            self.job_store[file_name] = {
                "status": "completed",
                "slides": slides,
            }

        except subprocess.CalledProcessError as e:
            self.job_store[file_name] = {
                "status": "failed",
                "error": f"Conversion failed: {e}",
            }
        except Exception as e:
            self.job_store[file_name] = {"status": "failed", "error": str(e)}


if __name__ == '__main__':
    img_extractor = ImageExtractor()
    img_extractor.extract_slides(
        '19f6607a-f71f-4752-89d1-66dfc08b29b8', 1, 5, 10
    )
