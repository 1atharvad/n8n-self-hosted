import logging
import sys


def get_shared_logger(name, level=logging.INFO):
    """
    Create or retrieve a shared logger instance with standardized
    formatting.

    Args:
        name (str): Name of the logger to create or retrieve.
        level (int, optional): Logging level (e.g., logging.INFO,
            logging.DEBUG). Defaults to logging.INFO.

    Returns:
        logging.Logger: Configured logger instance with console output and
            optional file handling.

    Behavior:
        - Adds a StreamHandler to output logs to stdout.
        - Optional FileHandler can be enabled to log to a file.
        - Prevents propagation to the root logger to avoid duplicate
            messages.
    """
    logger = logging.getLogger(name)

    if not logger.hasHandlers():
        logger.setLevel(level)

        # Console handler
        console_handler = logging.StreamHandler(sys.stdout)
        console_handler.setLevel(level)
        console_formatter = logging.Formatter(
            '%(asctime)s | %(name)s | %(levelname)s: %(message)s',
            datefmt='%H:%M:%S',
        )
        console_handler.setFormatter(console_formatter)
        logger.addHandler(console_handler)

        # Optional: File handler
        # file_handler = logging.FileHandler("obs_show.log")
        # file_handler.setLevel(level)
        # file_handler.setFormatter(console_formatter)
        # logger.addHandler(file_handler)

        # Prevent logs from propagating to the root logger
        logger.propagate = False

    return logger
