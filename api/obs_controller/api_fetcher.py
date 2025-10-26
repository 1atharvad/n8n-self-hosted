import os
from io import BytesIO

import requests
from PIL import Image

API_URL = os.getenv("API_URL")
SHOW_SCHEDULING_API_URL = os.getenv("SHOW_SCHEDULING_API_URL")
SHOW_SCHEDULING_API_KEY = os.getenv("SHOW_SCHEDULING_API_KEY")


class ShowApiHandler:
    """
    Handles interaction with the Show Scheduling API and retrieves
    show-specific information, including advertisements and QR codes.

    Attributes:
        show_id (str): Unique identifier for the show to fetch details for.
    """

    def __init__(self, show_id):
        """
        Initialize the ShowApiHandler with a specific show ID.

        Args:
            show_id (str): Identifier of the show to manage and fetch
                details for.
        """
        self.show_id = show_id

    @staticmethod
    def get_image_dimensions(url):
        """
        Retrieve the dimensions of an image from a given URL.

        Args:
            url (str): Direct URL to the image file.

        Returns:
            dict: A dictionary containing 'width' and 'height' of the image.

        Raises:
            HTTPError: If the HTTP request to the image URL fails.
        """
        resp = requests.get(url)
        resp.raise_for_status()
        img = Image.open(BytesIO(resp.content))
        return {'width': img.width, 'height': img.height}

    def fetch_schedule_details(self):
        """
        Fetch the complete scheduling and show information from the Show
        Scheduling API.

        Returns:
            dict: A dictionary containing the show's display and asset
                information.

        Raises:
            ValueError: If the API response is not valid JSON.
            RuntimeError: If the HTTP request fails with a non-200 status
                code.
        """
        url = f"{SHOW_SCHEDULING_API_URL}/api/gettvshowinfo/{self.show_id}"
        headers = {
            "apikey": SHOW_SCHEDULING_API_KEY,
            "Content-Type": "application/json",
        }

        response = requests.get(url, headers=headers)

        if response.status_code == 200:
            try:
                json_data = response.json()
                return json_data.get('responseMessage', {}).get('Display', {})
            except ValueError as err:
                raise ValueError("Response is not valid JSON.") from err
        else:
            raise RuntimeError(
                f"Request failed with status code {response.status_code}"
            )

    def get_ad_details(self):
        """
        Extract advertisement details for the show, including URLs and
        image dimensions.

        Returns:
            list[dict]: A list of dictionaries, each containing:
                - file_name (str): Name of the advertisement asset.
                - link (str): URL to the advertisement media.
                - width (int): Width of the ad image.
                - height (int): Height of the ad image.
        """
        data = self.fetch_schedule_details()

        return [
            {
                'file_name': ad_asset,
                'link': f"{API_URL}/obs/advertisement/{ad_asset}",
                'width': img_dim.get('width'),
                'height': img_dim.get('height'),
            }
            for _, info in data.items()
            if isinstance(info, dict) and info.get("location") == "advtbar"
            for ad_item in info.get("0", [])
            if (ad_asset := ad_item.get("advertisement_asset", ""))
            and (link := f"{SHOW_SCHEDULING_API_URL}/advertisement/{ad_asset}")
            and (img_dim := self.get_image_dimensions(link))
        ]

    @staticmethod
    def get_qr_info(key):
        """
        Map a key to specific QR code metadata used to construct asset URLs
        and extract text.

        Args:
            key (str): The QR code type key.

        Returns:
            dict: Metadata dictionary containing:
                - asset_key (str): Key in the QR data to get filename.
                - sub_link (str): API path for accessing the QR code.
                - text_type (str): Field for extracting text content.
        """
        if key == '4':
            return {
                'asset_key': 'training_qrcode_id',
                'sub_link': '/actionbar/training/',
                'text_type': 'web_link,',
            }
        elif key == '5':
            return {
                'asset_key': 'assessment_qrcode_filename',
                'sub_link': '/actionbar/assessment/',
                'text_type': 'assessment_test_link',
            }
        elif key == '5':
            return {
                'asset_key': 'assessment_qrcode_filename',
                'sub_link': '/actionbar/assessment/',
                'text_type': 'assessment_test_link',
            }
        elif key == '6':
            return {
                'asset_key': 'interview_qr_code',
                'sub_link': '/actionbar/interviewroom/',
                'text_type': 'conference_system_type',
            }
        elif key == '7':
            return {
                'asset_key': 'qrcode_filename',
                'sub_link': '/actionbar/jobdesc/',
                'text_type': 'id',
            }
        else:
            return {}

    def get_qr_details(self):
        """
        Extract QR code details for the show, including file names, URLs,
        image dimensions, and associated text.

        Returns:
            list[dict]: A list of dictionaries, each containing:
                - file_name (str): Name of the QR code asset.
                - link (str): URL to the QR code.
                - text (str): Associated text from the schedule.
                - width (int): Width of the QR code image.
                - height (int): Height of the QR code image.
        """
        data = self.fetch_schedule_details()

        return [
            {
                'file_name': qr_asset,
                'link': link,
                'text': qr_item.get(qr_metadata.get('text_type', '')),
                'width': img_dim.get('width'),
                'height': img_dim.get('height'),
            }
            for key, info in data.items()
            if isinstance(info, list) and len(info) != 0
            for qr_item in info
            if qr_item.get("location") == "actionbar"
            and (qr_metadata := self.get_qr_info(key))
            and (qr_asset := qr_item.get(qr_metadata.get('asset_key', '')))
            and (
                link := f"{SHOW_SCHEDULING_API_URL}{qr_metadata.get('sub_link', '/')}{qr_asset}"
            )
            and (img_dim := self.get_image_dimensions(link))
        ]


if __name__ == '__main__':
    api = ShowApiHandler(show_id="Stream01")
    print(api.get_ad_details())
    print(api.get_qr_details())
