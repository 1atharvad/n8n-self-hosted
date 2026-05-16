import os
import time
import socket
import docker

CHECK_INTERVAL = int(os.getenv("CHECK_INTERVAL", 10))
RECONNECT_GRACE_SEC = int(os.getenv("RECONNECT_GRACE_SEC", 60))
TARGET_CONTAINERS = [
    c.strip()
    for c in os.getenv("TARGET_CONTAINERS", "n8n").split(",")
    if c.strip()
]

def internet_connected(host="8.8.8.8", port=53, timeout=3):
    try:
        socket.setdefaulttimeout(timeout)
        socket.socket(socket.AF_INET, socket.SOCK_STREAM).connect((host, port))
        return True
    except socket.error:
        return False

def restart_docker_containers():
    client = docker.from_env()
    for name in TARGET_CONTAINERS:
        # Try exact name first; fall back to Compose service label for scaled services
        try:
            containers = client.containers.list(
                filters={"label": f"com.docker.compose.service={name}"}
            )
            if not containers:
                containers = [client.containers.get(name)]
        except Exception:
            print(f"[ERROR] Failed to find container(s) for {name}")
            continue

        for container in containers:
            try:
                container.restart()
                print(f"[INFO] Restarted Docker container: {container.name}")
            except Exception as e:
                print(f"[ERROR] Failed to restart Docker container {container.name}: {e}")

def monitor_and_restart():
    was_connected = True
    disconnected_since: float | None = None
    while True:
        if internet_connected():
            if not was_connected:
                down_sec = time.time() - disconnected_since
                if down_sec >= RECONNECT_GRACE_SEC:
                    print(f"[INFO] Internet reconnected after {down_sec:.0f}s. Restarting containers...")
                    restart_docker_containers()
                else:
                    print(f"[INFO] Internet reconnected after {down_sec:.0f}s (< grace {RECONNECT_GRACE_SEC}s). Skipping restart.")
            was_connected = True
            disconnected_since = None
        else:
            if was_connected:
                disconnected_since = time.time()
            print("[WARNING] Internet disconnected.")
            was_connected = False

        time.sleep(CHECK_INTERVAL)

if __name__ == "__main__":
    monitor_and_restart()
