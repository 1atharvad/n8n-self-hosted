FROM python:3.11-slim
WORKDIR /app
COPY check_connection.py .
RUN pip install --no-cache-dir --upgrade pip
RUN pip install docker
CMD ["python", "-u", "check_connection.py"]