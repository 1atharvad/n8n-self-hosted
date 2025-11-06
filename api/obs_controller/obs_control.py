import asyncio
import os
from pathlib import Path

from obsws_python import EventClient, ReqClient

from .api_fetcher import ShowApiHandler
from .logger_config import get_shared_logger
from .obs_helper_func import OBSHelperFunc

BASE_DIR = Path(__file__).resolve().parent.parent.parent
VIDEO_FILE_DIR = Path(BASE_DIR, 'n8n_files', 'video_files')

API_URL = os.getenv("API_URL")
OBS_HOST = os.getenv("OBS_HOST", "localhost")
OBS_PORT = int(os.getenv("OBS_PORT", 4455))
OBS_PASSWORD = os.getenv("OBS_PASSWORD", "")
OBS_REMOTE_PATH = os.getenv("OBS_REMOTE_PATH")
DEFAULT_AD_WIDTH = 600

logger = get_shared_logger("OBS_Show_Runner")


class OBSController(OBSHelperFunc):
    """
    Main controller class for managing all interactions with OBS via
    WebSocket.

    Inherits from:
        OBSHelperFunc: Provides helper methods for interacting with OBS
            WebSocket.

    Responsibilities:
        - Manages scenes, streaming, and recording operations.
        - Handles intro/outro playback and queued media.
        - Integrates with external show APIs for ad management and
            configuration.
    """

    def __init__(self):
        """
        Initialize the OBSController by creating a WebSocket client
        connection to OBS.

        Sets up:
            - A ReqClient instance for OBS communication.
            - Parent class initialization with the same client connection.
        """
        self.client = ReqClient(
            host=OBS_HOST, port=OBS_PORT, password=OBS_PASSWORD
        )
        self.ev_client = EventClient(
            host=OBS_HOST, port=OBS_PORT, password=OBS_PASSWORD
        )
        super().__init__(self.client)

    def initiate_show_api(self, show_id):
        """
        Initialize the Show API handler for fetching configuration and
        advertisement details.

        Args:
            show_id (str): Unique identifier for the show to retrieve ad
                and layout data.
        """
        self.show_api = ShowApiHandler(show_id)

    async def rotate_ads(self, scene_name, source_name, interval):
        """
        Continuously cycles through available ad sources in a specified OBS
        scene.

        Args:
            scene_name (str): The name of the scene where ads are displayed.
            source_name (str): The source element to update with new ad
                URLs.
            interval (int): Time delay (in seconds) between ad rotations.

        Behavior:
            - Fetches ad details from the Show API.
            - Updates the media source URL and dimensions dynamically.
            - Repeats the process indefinitely at the specified interval.
        """
        ad_details = self.show_api.get_ad_details()
        index = 0

        while True:
            try:
                ad_info = ad_details[index]
                self.client.set_input_settings(
                    source_name,
                    {
                        "url": ad_info.get('link'),
                        "width": DEFAULT_AD_WIDTH,
                        "height": ad_info.get('height')
                        * DEFAULT_AD_WIDTH
                        / ad_info.get('width'),
                    },
                    overlay=False,
                )
                await asyncio.sleep(0.05)
                self.center_align_vertically(scene_name, source_name)
                logger.info(f"[{source_name}] → {ad_info.get('file_name')}")
            except Exception as e:
                logger.error(f"[{source_name}] Error: {e}")

            index += 1
            if index == len(ad_details):
                index = 0

            await asyncio.sleep(interval)

    async def play_intro(self, first=False):
        """
        Play the intro sequence by switching to the intro scene and playing
        the intro video.

        Args:
            first (bool, optional): If True, logs that the intro is being
                played at startup.

        Behavior:
            - Loads the intro video from the API endpoint.
            - Switches to the 'IntroScene' in OBS.
            - Waits for the video to finish before continuing execution.
        """
        logger.info(f"{'Starting' if first else 'Running'} intro sequence")
        self.client.set_input_settings(
            "IntroSource",
            {
                # "input": f"{API_URL}/get-video/intro",
                # "is_local_file": False,
                "input": f"{OBS_REMOTE_PATH}/intro.mp4",
                "is_local_file": True,
                "restart_on_activate": True,
                "close_when_inactive": False,
            },
            overlay=True,
        )
        await self.change_scene("IntroScene")

        intro_path = Path(BASE_DIR, 'n8n_files', 'intro.mp4')
        intro_duration = self.get_video_duration(str(intro_path))

        logger.info(f"Playing intro for {intro_duration:.2f} seconds")
        logger.warning(intro_duration)
        await asyncio.sleep(intro_duration)

    async def play_outro(self):
        """
        Play the outro sequence by switching to the outro scene and waiting
        for completion.

        Behavior:
            - Loads the outro video from the API endpoint.
            - Switches to the 'OutroScene' in OBS.
            - Waits for the outro video duration before proceeding.
        """
        logger.info("Starting outro sequence")
        self.client.set_input_settings(
            "OutroSource",
            {
                # "input": f"{API_URL}/get-video/outro",
                # "is_local_file": False,
                "input": f"{OBS_REMOTE_PATH}/outro.mp4",
                "is_local_file": True,
                "restart_on_activate": True,
                "close_when_inactive": False,
            },
            overlay=True,
        )
        await self.change_scene("OutroScene")

        outro_path = Path(BASE_DIR, 'n8n_files', 'outro.mp4')
        outro_duration = self.get_video_duration(str(outro_path))

        logger.info(f"Playing outro for {outro_duration:.2f} seconds")
        await asyncio.sleep(outro_duration)

    async def play_videos(self, video_queue):
        """
        Sequentially plays all videos from the provided queue within the
        main layout.

        Args:
            video_queue (Queue): A queue-like object containing video file
                names.

        Behavior:
            - Retrieves each video from the queue.
            - Loads and plays it in the 'Layout1' scene.
            - Waits for each video's duration before moving to the next.
            - Plays the intro sequence when the queue is empty.
        """
        while video_queue.queue_open:
            if not video_queue.is_empty():
                next_video_file = video_queue.get_next_video()

                if next_video_file:
                    video_path = Path(VIDEO_FILE_DIR, next_video_file)
                    video_file = str(video_path)

                    try:
                        video_duration = self.get_video_duration(video_file)
                        await self.change_scene("Layout1")
                        self.client.trigger_media_input_action(
                            "MainVideo",
                            "OBS_WEBSOCKET_MEDIA_INPUT_ACTION_STOP",
                        )
                        self.client.set_input_settings(
                            "MainVideo",
                            {
                                # "input": f"{API_URL}/get-video/{video_path.name.replace('.mp4', '')}",
                                # "is_local_file": False,
                                "input": f"{OBS_REMOTE_PATH}/{video_path.name}",
                                "is_local_file": True,
                                "restart_on_activate": True,
                                "close_when_inactive": False,
                            },
                            overlay=True,
                        )
                        self.client.trigger_media_input_action(
                            "MainVideo",
                            "OBS_WEBSOCKET_MEDIA_INPUT_ACTION_RESTART",
                        )
                        logger.info(f"▶️ Now playing: {video_path.name}")
                        logger.info(
                            f"Video Duration: {int(video_duration // 60):02d}:{int(video_duration % 60):02d}"
                        )
                        await asyncio.sleep(video_duration)
                    except Exception as e:
                        logger.error(f"[MainVideo] Error: {e}")
                        break
                else:
                    await self.play_intro()
            else:
                await self.play_intro()

    def start_stream(self, force_start=False):
        """
        Start a live stream in OBS.

        Args:
            force_start (bool, optional): If True, restarts the stream even
            if already active.

        Behavior:
            - Checks the current streaming state.
            - Starts or restarts streaming accordingly.
            - Logs the stream status to the console.
        """
        is_streaming = self.client.get_stream_status().output_active

        if is_streaming and force_start:
            self.client.stop_stream()
        if not is_streaming:
            self.client.start_stream()
            logger.info("🔴 Streaming started...")
        else:
            logger.warning("🟡 Streaming already started.")

    def stop_stream(self):
        """
        Stop the live stream if it is active.

        Behavior:
            - Stops the OBS stream if currently active.
            - Switches the current scene to 'EmptyScene' after stopping.
            - Logs the resulting status.
        """
        is_streaming = self.client.get_stream_status().output_active

        if is_streaming:
            self.client.stop_stream()
            logger.info("🟢 Streaming ended.")
        else:
            logger.warning("🟡 Streaming not started or previously ended.")
        self.client.set_current_program_scene("EmptyScene")

    def start_recording(self, force_start=False):
        """
        Start recording the current OBS session.

        Args:
            force_start (bool, optional): If True, restarts the recording
                if already active.

        Behavior:
            - Checks the current recording state.
            - Starts or restarts the recording session accordingly.
            - Logs relevant information.
        """
        is_recording = self.client.get_record_status().output_active

        if is_recording and force_start:
            self.client.stop_record()
        if not is_recording:
            self.client.start_record()
            logger.info("🔴 Recording started...")
        else:
            logger.warning("🟡 Recording already started.")

    def stop_recording(self):
        """
        Stop the ongoing OBS recording session.

        Behavior:
            - Stops the recording if active.
            - Logs whether the session was ended or not running.
        """

        is_recording = self.client.get_record_status().output_active

        if is_recording:
            self.client.stop_record()
            logger.info("🟢 Recording ended.")
        else:
            logger.warning("🟡 Recording not started or previously ended.")

    async def change_scene(self, scene_name):
        """
        Switch the OBS program scene to the specified one.

        Args:
            scene_name (str): The name of the target scene to switch to.

        Behavior:
            - If the requested scene is already active, switches
                temporarily to 'EmptyScene' before applying the change.
        """
        current_scene = self.client.get_current_program_scene()

        if current_scene.current_program_scene_name == scene_name:
            self.client.set_current_program_scene("EmptyScene")
            await asyncio.sleep(1)
        self.client.set_current_program_scene(scene_name)

    async def start_event_listener(self, max_duration: int):
        """
        Continuously monitor OBS streaming via event listener until stopped or
        maximum duration is reached.

        Args:
            max_duration (int): The maximum duration (in seconds) to allow the
                stream to run.

        Behavior:
            - Uses OBS EventClient to react to stream start/stop events in
                real-time.
            - When the stream starts, schedules an automatic stop after
                `max_duration`.
            - Cancels the auto-stop timer if the stream is manually stopped
                before the duration ends.
            - Logs all relevant events: stream started, manually stopped, or
                auto-stopped.
            - Designed to run asynchronously alongside other tasks (ad
                rotation, video playback, etc.).
        """

        async def stop_stream():
            logger.info(
                f"⏰ Auto-stopping stream after {max_duration} seconds"
            )
            try:
                self.client.stop_stream()
                logger.info("🛑 Stream stopped by timer.")
            except Exception as e:
                logger.error(f"Failed to stop stream: {e}")

        async def stop_stream_after_delay():
            await asyncio.sleep(max_duration)
            await stop_stream()

        def on_stream_state_changed(event):
            if event.outputActive:
                logger.info("🎥 Stream started — scheduling auto-stop timer.")

                if (
                    self.stream_timer_task
                    and not self.stream_timer_task.done()
                ):
                    self.stream_timer_task.cancel()
                self.stream_timer_task = asyncio.create_task(
                    stop_stream_after_delay()
                )
            else:
                logger.info("⏹️ Stream stopped manually.")

                if (
                    self.stream_timer_task
                    and not self.stream_timer_task.done()
                ):
                    self.stream_timer_task.cancel()

        self.ev_client.callback.on_stream_state_changed = (
            on_stream_state_changed
        )

        logger.info("✅ Listening for OBS stream events...")
        await self.ev_client.run_forever()
