import os
import time
import socket
import docker

CHECK_INTERVAL = int(os.getenv("CHECK_INTERVAL", 10))
TARGET_CONTAINER = os.getenv("TARGET_CONTAINER", "n8n")

def internet_connected(host="8.8.8.8", port=53, timeout=3):
    try:
        socket.setdefaulttimeout(timeout)
        socket.socket(socket.AF_INET, socket.SOCK_STREAM).connect((host, port))
        return True
    except socket.error:
        return False

def restart_docker_container():
    try:
        client = docker.from_env()
        container = client.containers.get(TARGET_CONTAINER)
        container.restart()
        print(f"[INFO] Restarted Docker container: {TARGET_CONTAINER}")
    except Exception as e:
        print(f"[ERROR] Failed to restart Docker container: {e}")

def monitor_and_restart():
    was_connected = True
    while True:
        if internet_connected():
            if not was_connected:
                print("[INFO] Internet reconnected. Restarting n8n...")
                restart_docker_container()
                was_connected = True
        else:
            print("[WARNING] Internet disconnected.")
            was_connected = False

        time.sleep(CHECK_INTERVAL)

if __name__ == "__main__":
    monitor_and_restart()
