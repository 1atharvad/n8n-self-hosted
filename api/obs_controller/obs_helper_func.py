import asyncio
import re
from time import sleep

from moviepy import VideoFileClip
from obsws_python import ReqClient


class OBSHelperFunc:
    """
    Provides helper functions for interacting with OBS, including video
    duration retrieval, scene item positioning, and QR code management
    (adding, updating, and animating QR codes in a scene).

    Attributes:
        client (ReqClient): OBS WebSocket client instance.
        qr_code_scene (str): Scene name where QR codes are displayed.
        settings (dict): Video output settings fetched from OBS.
    """

    def __init__(self, client):
        """
        Initialize the helper with a ReqClient instance and fetch video
        settings.

        Args:
            client (ReqClient): An active OBS WebSocket client instance.
        """
        self.client = client
        self.qr_code_scene = "QRCodeSlider"
        self.settings = client.get_video_settings()

    @staticmethod
    def get_video_duration(file_path):
        """
        Retrieve the duration of a video file.

        Args:
            file_path (str): Path to the video file.

        Returns:
            float: Duration of the video in seconds.
        """
        clip = VideoFileClip(file_path)
        duration = clip.duration
        clip.close()
        return duration

    def center_align_vertically(self, scene_name, source_name):
        """
        Center a scene item vertically within a given scene based on its
        height.

        Args:
            scene_name (str): Name of the OBS scene.
            source_name (str): Name of the source within the scene to
                align.
        """
        source_item = self.client.get_scene_item_id(scene_name, source_name)
        source_pos_details = self.client.get_scene_item_transform(
            scene_name, source_item.scene_item_id
        ).scene_item_transform
        source_height = source_pos_details.get('height')
        scene_height = self.settings.output_height

        self.client.set_scene_item_transform(
            scene_name,
            source_item.scene_item_id,
            {
                "positionY": (scene_height - source_height) / 2,
            },
        )

    def add_or_update_qr_codes(self, qr_details_list):
        """
        Add or update QR code images and corresponding text sources in the
        designated QR code scene. Positions each QR code and text relative
        to reference items and maintains spacing between multiple QR codes.

        Args:
            qr_details_list (list[dict]): List of QR code details including:
                - link (str): URL to the QR code image.
                - text (str): Text associated with the QR code.
                - width (int): Width of the QR code image.
                - height (int): Height of the QR code image.
        """
        ref_image = "Ref_Image_QR"
        ref_text = "Ref_Text_QR"
        image_source_name = "Image_QR"
        text_source_name = "Text_QR"
        pattern = r'^(?:Image_QR|Text_QR)(\d+)$'
        left_padding = 0
        item_spacing = 150

        scene_items_obj = self.client.get_scene_item_list(self.qr_code_scene)
        for scene_item in scene_items_obj.scene_items:
            scene_item_name = scene_item.get('sourceName')
            if match := re.match(pattern, scene_item_name):
                if int(match.group(1)) > len(qr_details_list):
                    self.client.remove_input(scene_item_name)

        for index, qr_details in enumerate(qr_details_list):
            # To add browser source with QR code
            ref_item = self.client.get_scene_item_id(
                self.qr_code_scene, ref_image
            )
            ref_pos_details = self.client.get_scene_item_transform(
                self.qr_code_scene, ref_item.scene_item_id
            ).scene_item_transform
            img_height = ref_pos_details.get('height')

            link = qr_details.get('link')
            img_width = (
                qr_details.get('width') * img_height / qr_details.get('height')
            )

            try:
                scene_item = self.client.get_scene_item_id(
                    self.qr_code_scene, f"{image_source_name}{index + 1}"
                )

                self.client.set_input_settings(
                    f"{image_source_name}{index + 1}",
                    {
                        "url": link,
                        "width": img_width,
                        "height": img_height,
                    },
                    overlay=False,
                )

                print(
                    f"Source '{image_source_name}{index + 1}' exists in scene '{self.qr_code_scene}' (ID: {scene_item.scene_item_id})"
                )
            except Exception:
                print(
                    f"Source '{image_source_name}{index + 1}' does not exist. Creating a new one."
                )

                scene_item = self.client.create_input(
                    self.qr_code_scene,
                    f"{image_source_name}{index + 1}",
                    "browser_source",
                    inputSettings={
                        "url": link,
                        "width": img_width,
                        "height": img_height,
                    },
                    sceneItemEnabled=True,
                )

            img_pos_x = ref_pos_details.get('positionX')
            self.client.set_scene_item_transform(
                self.qr_code_scene,
                scene_item.scene_item_id,
                {
                    "positionX": left_padding + img_pos_x,
                    "positionY": ref_pos_details.get('positionY'),
                },
            )

            # To add text source with name for the QR code
            ref_info = self.client.get_input_settings(ref_text).input_settings
            ref_item = self.client.get_scene_item_id(
                self.qr_code_scene, ref_text
            )
            ref_pos_details = self.client.get_scene_item_transform(
                self.qr_code_scene, ref_item.scene_item_id
            ).scene_item_transform

            text = qr_details.get('text')

            try:
                scene_item = self.client.get_scene_item_id(
                    self.qr_code_scene, f"{text_source_name}{index + 1}"
                )
                self.client.set_input_settings(
                    f"{text_source_name}{index + 1}",
                    {
                        "text": text,
                        "color1": ref_info.get('color1'),
                        "color2": ref_info.get('color2'),
                        "font": ref_info.get('font'),
                    },
                    overlay=False,
                )
                print(
                    f"Source '{text_source_name}{index + 1}' exists in scene '{self.qr_code_scene}' (ID: {scene_item.scene_item_id})"
                )
            except Exception:
                print(
                    f"Source '{text_source_name}{index + 1}' does not exist. Creating a new one."
                )

                scene_item = self.client.create_input(
                    self.qr_code_scene,
                    f"{text_source_name}{index + 1}",
                    "text_ft2_source_v2",
                    inputSettings={
                        "text": text,
                        "color1": ref_info.get('color1'),
                        "color2": ref_info.get('color2'),
                        "font": ref_info.get('font'),
                    },
                    sceneItemEnabled=True,
                )

            sleep(0.05)
            text_source_pos_details = self.client.get_scene_item_transform(
                self.qr_code_scene, scene_item.scene_item_id
            ).scene_item_transform
            extra_pos_x = (
                img_width - text_source_pos_details.get('width')
            ) / 2
            self.client.set_scene_item_transform(
                self.qr_code_scene,
                scene_item.scene_item_id,
                {
                    "positionX": left_padding + img_pos_x + extra_pos_x,
                    "positionY": ref_pos_details.get('positionY'),
                },
            )
            left_padding += img_width + item_spacing

    async def rotate_qr_code(
        self, scene_item_id, initial_pos, max_item_pos, max_item_width
    ):
        """
        Animate a single QR code scene item by moving it horizontally
        across the scene in a loop, resetting its position when it reaches
        the end.

        Args:
            scene_item_id (int): ID of the scene item to animate.
            initial_pos (float): Starting X position for the animation.
            max_item_pos (float): Maximum X position before resetting.
            max_item_width (float): Width of the QR code item for reset
                calculation.
        """
        try:
            pos_x = initial_pos
            while True:
                pos_x += 1
                self.client.set_scene_item_transform(
                    self.qr_code_scene,
                    scene_item_id,
                    {
                        "positionX": pos_x,
                    },
                )
                if pos_x >= int(max_item_pos):
                    pos_x = -int(max_item_width)
                await asyncio.sleep(0.05)
        except Exception as e:
            print(f"⚠️ Error rotating item {scene_item_id}: {e}")

    async def rotate_qr_codes(self):
        """
        Animate all QR code scene items within the QR code scene
        concurrently, using `rotate_qr_code` for individual item movement.

        Behavior:
            - Finds all scene items matching QR code naming patterns.
            - Computes initial positions and widths.
            - Starts asynchronous tasks to rotate all QR codes
                simultaneously.
        """

        pattern = r'^(?:Image_QR|Text_QR)(\d+)$'
        tasks_details = []

        scene_items_obj = self.client.get_scene_item_list(self.qr_code_scene)
        for scene_item in scene_items_obj.scene_items:
            scene_item_name = scene_item.get('sourceName')
            scene_item_id = scene_item.get('sceneItemId')
            if re.match(pattern, scene_item_name):
                source_pos_details = self.client.get_scene_item_transform(
                    self.qr_code_scene, scene_item_id
                ).scene_item_transform
                initial_pos = source_pos_details.get('positionX')

                tasks_details.append(
                    {
                        "scene_item_id": scene_item_id,
                        "initial_pos": initial_pos,
                        "item_width": source_pos_details.get('width'),
                    }
                )

        max_item_width = max(
            tasks_details, key=lambda detail: detail.get('item_width', 0)
        ).get('item_width')
        max_item_pos = tasks_details[-1].get('initial_pos')
        tasks = [
            asyncio.create_task(
                self.rotate_qr_code(
                    details.get('scene_item_id'),
                    details.get('initial_pos'),
                    max_item_pos,
                    max_item_width,
                )
            )
            for details in tasks_details
        ]

        if tasks:
            await asyncio.gather(*tasks)


if __name__ == '__main__':
    client = ReqClient(
        host='localhost', port=4455, password='AHewVrpaTtEcejkZ'
    )

    helper_func = OBSHelperFunc(client)
    # helper_func.add_or_update_qr_codes()
    # asyncio.run(helper_func.rotate_qr_codes())
    helper_func.center_align_vertically("Layout1", "Ad Image")
