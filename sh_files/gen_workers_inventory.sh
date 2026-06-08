#!/bin/bash
set -e

if [ -z "$CONTABO_WORKER_IP" ]; then
  echo "Error: CONTABO_WORKER_IP is not set"
  exit 1
fi

OUT="ansible/inventory/multi/workers_dynamic.yml"

cat > "$OUT" << 'YAML'
all:
  children:
    workers:
      vars:
        ansible_user: root
        ansible_ssh_private_key_file: ~/.ssh/id_ed25519
        github_deploy_key_path: /root/.ssh/id_ed25519
        compose_file: docker/docker-compose.prod-worker.yml
      hosts:
YAML

IFS=',' read -ra IPS <<< "$CONTABO_WORKER_IP"
for i in "${!IPS[@]}"; do
  IP=$(echo "${IPS[$i]}" | xargs)
  echo "        worker-$((i+1)):" >> "$OUT"
  echo "          ansible_host: $IP" >> "$OUT"
done

echo "Generated $OUT with ${#IPS[@]} worker(s)"
