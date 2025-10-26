import asyncio
from datetime import datetime
from pathlib import Path

from .logger_config import get_shared_logger
from .obs_control import OBSController
from .queueing_loop import QueueingLoop

BASE_DIR = Path(__file__).resolve().parent.parent.parent
VERTICAL_ADS_DIR = Path(BASE_DIR, 'n8n_files', 'ads_files', 'vertical_ads')
HORIZONTAL_ADS_DIR = Path(BASE_DIR, 'n8n_files', 'ads_files', 'horizontal_ads')

logger = get_shared_logger("OBS_Show_Runner")


class ShowRunner:
    """
    Manages the end-to-end running of an OBS show, including video playback,
    ad rotation, QR code updates, streaming, and recording.

    Attributes:
        obs (OBSController): Interface for controlling OBS operations.
        video_queue (QueueingLoop): Queue system for managing videos to play.
        show_start_time (datetime | None): Timestamp when the show started.
        is_running (bool): Flag indicating if a show is currently active.
    """

    def __init__(self):
        self.obs = OBSController()
        self.video_queue = QueueingLoop()
        self.show_start_time = None
        self.is_running = False

    def initialize_video_queue(self, video_list):
        """
        Initialize the video queue with a list of videos for the show.

        Args:
            video_list (list[str]): List of video filenames to enqueue.
        """
        self.video_queue.queue_open = True

        for video_file in video_list:
            self.video_queue.add_new_video(video_file)

    async def run_main_show(self, max_duration):
        """
        Run the main show content asynchronously, including ad rotation,
        QR code animation, video playback, and stream monitoring.

        Args:
            max_duration (int): Maximum duration of the show in seconds.

        Raises:
            Exception: If any underlying task fails during the main show.
        """
        logger.info("Starting main show content")

        # Launch independent async tasks
        tasks = [
            asyncio.create_task(
                self.obs.rotate_ads("Layout1", "Ad Image", 60),
                name="vertical_ads",
            ),
            asyncio.create_task(self.obs.rotate_qr_codes(), name="qr_codes"),
            asyncio.create_task(
                self.obs.play_videos(self.video_queue), name="video_playback"
            ),
            asyncio.create_task(
                self.obs.monitor_stream_status(max_duration),
                name="stream_monitor",
            ),
        ]

        try:
            done_tasks, pending_tasks = await asyncio.wait(
                tasks, return_when=asyncio.FIRST_COMPLETED
            )

            for task in done_tasks:
                logger.warning(
                    f"Task '{task.get_name()}' completed unexpectedly"
                )

                if task.exception():
                    logger.error(
                        f"Task '{task.get_name()}' raised exception: {task.exception()}"
                    )

            for task in pending_tasks:
                logger.info(f"Cancelling task '{task.get_name()}'")
                task.cancel()

            await asyncio.gather(*pending_tasks, return_exceptions=True)

        except Exception as e:
            logger.error(f"Error during main show: {e}")

            for task in tasks:
                if not task.done():
                    task.cancel()
            raise

    async def run_show(self, show_id, max_duration=3600, video_list=None):
        """
        Run the full show from start to finish, including intro, main
        content, and outro sequences.

        Args:
            show_id (str): Identifier of the show for fetching API data.
            max_duration (int, optional): Maximum duration of the show in
                seconds.
            video_list (list[str] | None, optional): List of videos to play.

        Raises:
            asyncio.CancelledError: If the show is manually cancelled.
            Exception: If an unexpected error occurs during the show.
        """
        if self.is_running:
            video_list = []

        if video_list is None:
            logger.warning("Show can't be started, no videos added")
            return

        self.is_running = True
        self.show_start_time = datetime.now()
        logger.info(f"Show started at {self.show_start_time}")

        try:
            self.initialize_video_queue(video_list)
            self.obs.initiate_show_api(show_id)
            self.obs.add_or_update_qr_codes(self.obs.show_api.get_qr_details())

            logger.info("Starting stream")
            self.obs.start_stream()

            await self.obs.play_intro(first=True)
            await self.run_main_show(max_duration)
            await self.obs.play_outro()

        except asyncio.CancelledError:
            logger.info("Show was cancelled")
            raise
        except Exception as e:
            logger.error(f"Error during show: {e}", exc_info=True)
            raise
        finally:
            logger.info("Stopping stream")
            self.obs.stop_stream()

            show_duration = (
                datetime.now() - self.show_start_time
            ).total_seconds()
            logger.info(
                f"Show ended. Total duration: {show_duration:.2f} seconds"
            )

            self.is_running = False
            self.show_start_time = None

    async def add_new_video_in_show(self, video_file):
        """
        Add a new video to the currently running show queue.

        Args:
            video_file (str): Path or filename of the video to add.
        """
        logger.info("Adding new video in the show...")
        self.video_queue.add_new_video(video_file)

    async def stop_show(self):
        """
        Gracefully stop the currently running show, close the video queue,
        and clear remaining videos.
        """
        logger.info("Stopping show gracefully...")
        self.video_queue.queue_open = False
        self.video_queue.clear_all()

    def cleanup(self):
        """
        Perform end-of-day cleanup, clearing the video queue and resetting
        internal state.
        """
        logger.info("Cleaning up ShowRunner resources")
        self.video_queue.clear_all()
        self.show_start_time = None


if __name__ == "__main__":
    sr = ShowRunner()
    video_list = [
        '4dd512f0-c368-4337-9338-5849c3d60636.mp4',
        '0322fe13-d2fd-4bf6-b6d0-24d289ca718f.mp4',
    ]

    asyncio.run(sr.run_show(video_list))
