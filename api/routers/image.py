from fastapi import APIRouter, BackgroundTasks, HTTPException
from fastapi.responses import FileResponse, JSONResponse

from schemas import ExtractSlidesRequest, PPTRequest
from .utils import PPT_FILES_DIR, respond_job_status
from video_generator import ImageExtractor, PPTGenerator

router = APIRouter(tags=["Image Generator"])
img_ext = ImageExtractor()


@router.post('/ppt-generator')
async def ppt_generator(req: PPTRequest):
    """
    Generates PowerPoint slides based on a template and user-specified text
    replacements.

    Args:
        req (PPTRequest): Contains 'template_slide', 'old_text', and 'jobs'
            list for slide creation.

    Returns:
        File info including path, name, and total slides created.
    """
    ppt = PPTGenerator(req.template_file)
    ppt.template_slide = req.template_slide
    ppt.old_text = req.old_text
    file_path = ppt.create_slide(req.jobs)
    return JSONResponse(
        {
            'file_name': file_path.name,
            'file_path': str(file_path),
            'total_slides': str(len(req.jobs)),
        }
    )


@router.get('/ppt/{file_name}')
async def get_ppt_file(file_name: str):
    """
    Downloads a generated PowerPoint file by name.

    Args:
        file_name (str): Name of the PPTX file to retrieve.

    Returns:
        PowerPoint file or error if not found.
    """
    file_path = PPT_FILES_DIR / f'{file_name}.pptx'
    if not file_path.exists():
        raise HTTPException(status_code=404, detail="File not found")
    return FileResponse(
        path=str(file_path),
        media_type='application/vnd.openxmlformats-officedocument.presentationml.presentation',
        filename=file_path.name,
    )


@router.post('/extract-slides')
async def extract_slides(req: ExtractSlidesRequest, background_tasks: BackgroundTasks):
    """
    Extracts slides from a PowerPoint file as images in the background.

    Args:
        req (ExtractSlidesRequest): Contains 'file_name', 'start_slide',
            'end_slide', and 'total_slides'.
        background_tasks (BackgroundTasks): FastAPI background task manager.

    Returns:
        Job status with 'pending', 'completed', or 'failed'.
    """
    _, job = img_ext.set_job_status(req.file_name, status='pending')
    background_tasks.add_task(
        img_ext.extract_slides, req.file_name, req.start_slide, req.end_slide, req.total_slides, req.epoch, req.video_type
    )
    return JSONResponse(respond_job_status(req.file_name, job))


@router.get('/img-ext-status/{job_id}')
async def check_img_status(job_id: str):
    """
    Checks the current status of an image extraction job from a PowerPoint file.

    Args:
        job_id (str): Unique identifier of the image extraction job.

    Returns:
        A JSON object containing:
            - job_id (str): The ID of the job
            - status (str): Current job status ('pending', 'completed', 'failed')
            - error (str, optional): Error message if the job failed
            - stderr (str, optional): Additional error details if available
    """
    job = img_ext.get_job(job_id)
    return JSONResponse(respond_job_status(job_id, job))


@router.get('/img-ext-result/{job_id}')
async def get_img_result(job_id: str):
    """
    Retrieves the result of a completed image extraction job.

    Args:
        job_id (str): Unique identifier of the image extraction job.

    Returns:
        JSONResponse:
            - If completed: JSON object containing 'slides' list along with job
                status.
            - If not completed or failed: JSON object containing current job
                status and error details.
    """
    job = img_ext.get_job(job_id)
    job_response = respond_job_status(job_id, job)
    if job_response.get('status') == 'completed':
        return JSONResponse({**job_response, 'slides': job.get('slides')})
    return JSONResponse(job_response)
