import threading
from queue import PriorityQueue

from .logger_config import get_shared_logger

logger = get_shared_logger("OBS_Show_Runner")


class QueueClosedError(Exception):
    """
    Exception raised when attempting to operate on a queue that is closed.

    Attributes:
        message (str): Error message describing the exception.
    """

    def __init__(self, message="Queue is closed."):
        super().__init__(message)


def require_queue_open(func):
    """
    Decorator to ensure queue operations are only executed when the queue
    is open. Logs a warning if the queue is closed and skips function
    execution.
    """

    def wrapper(self, *args, **kwargs):
        if not self.queue_open:
            logger.warning(f"Skipped '{func.__name__}' — queue is closed.")
            return
        return func(self, *args, **kwargs)

    return wrapper


class QueueingLoop:
    """
    Implements a thread-safe priority queue system for video playback
    management.

    Attributes:
        video_playlist (PriorityQueue): Thread-safe priority queue storing
            videos.
        lock (threading.Lock): Lock to prevent race conditions during
            enqueue/dequeue.
        counter (int): Counter to maintain insertion order for items with
            same priority.
        queue_open (bool): Flag indicating whether the queue is open for
            operations.

    Behavior:
        - Videos with lower priority numbers are played first.
        - Supports adding videos with high or low priority.
        - Allows re-adding videos back to the loop for continuous playback.
        - Provides peek, clear, and empty checks for queue management.
    """

    def __init__(self, max_size: int = 20):
        """
        Initialize the video queue system.

        Args:
            max_size (int, optional): Maximum queue size. 0 indicates
                unlimited capacity.
        """
        self.video_playlist = PriorityQueue(maxsize=max_size)
        self.lock = threading.Lock()
        self.counter = 0
        self.queue_open = False

    @require_queue_open
    def enqueue(self, item: str, priority: int):
        """
        Add a video to the queue with a specific priority.

        Args:
            item (str): Video file path.
            priority (int): Lower numbers indicate higher priority.

        Returns:
            bool: True if video added successfully, False if the queue is
                full.
        """
        try:
            with self.lock:
                self.video_playlist.put_nowait((priority, self.counter, item))
                self.counter += 1
            return True
        except Exception:
            return False

    @require_queue_open
    def dequeue(self) -> str:
        """
        Remove and return the next video from the queue.

        Returns:
            str: Video file path of the next video, or None if queue is
                empty.
        """
        if not self.video_playlist.empty():
            try:
                _, _, item = self.video_playlist.get_nowait()
                return item
            except Exception:
                return None
        return None

    @require_queue_open
    def peek(self):
        """
        Preview the next video in the queue without removing it.

        Returns:
            tuple: (priority, video_file) of the next video, or (None,
            None) if empty.
        """
        if not self.video_playlist.empty():
            priority, counter, item = self.video_playlist.get_nowait()
            self.video_playlist.put_nowait((priority, counter, item))
            return priority, item
        return None, None

    @require_queue_open
    def is_empty(self) -> bool:
        """
        Check if the video queue is currently empty.

        Returns:
            bool: True if empty, False otherwise.
        """
        return self.video_playlist.empty()

    @require_queue_open
    def add_new_video(self, video_file):
        """
        Add a new video with high priority (plays sooner).

        Args:
            video_file: Path to video file

        Returns:
            bool: True if added successfully
        """
        return self.enqueue(video_file, priority=2)

    @require_queue_open
    def add_video_back_to_loop(self, video_file):
        """
        Re-add a video to the loop with lower priority (plays later).

        Args:
            video_file: Path to video file

        Returns:
            bool: True if added successfully
        """
        return self.enqueue(video_file, priority=3)

    @require_queue_open
    def get_next_video(self) -> str:
        """
        Get the next video and automatically re-add it to the loop.

        Returns:
            str: Video file path, or None if queue is empty
        """
        priority, _ = self.peek()

        if priority is None or priority >= 3:
            return None

        video_file = self.dequeue()

        if video_file:
            self.add_video_back_to_loop(video_file)
        return video_file

    @require_queue_open
    def clear_all(self):
        """
        Clear all videos from the queue. Use this at end of day to start fresh.
        """
        while not self.video_playlist.empty():
            try:
                self.video_playlist.get_nowait()
            except Exception:
                break


if __name__ == "__main__":
    loop = QueueingLoop()
    loop.enqueue('jk', 2)
    loop.enqueue('ujj', 2)
    loop.enqueue('19bvb', 2)
    print(loop.peek())
    print(loop.dequeue())
    print(loop.dequeue())
    print(loop.dequeue())
    print(loop.dequeue())
