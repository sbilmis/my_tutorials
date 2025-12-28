# Updating a Docker Application Safely (docker-compose)

This guide explains how to update a Dockerized application **without losing data**.  
It applies to any container started using `docker-compose`.

---

## Why Storage Can Be Lost (and How to Avoid It)

!!! warning "If your data lives *inside* a Docker container, updating will erase it"
    If you delete a container that contains its own data, that data is permanently removed.  
    **Never** store persistent information inside a container's internal filesystem.

To keep data safe, it must be mounted from the host:

```yaml
volumes:
  - ./storage:/app/server/storage
```

!!! note
    The path on the left (`./storage`) is on your filesystem.  
    Updating Docker containers **will not delete this directory**.

---

## Confirm That Storage Is Mounted

Before updating, verify that your deployment actually mounts storage correctly.

```bash
docker inspect <container-name> | grep -i Source -A1
```

Expected example:

```
"Source": "/home/user/app/storage",
"Destination": "/app/server/storage"
```

If `"Source"` points to a local path, your data is safe.

---

## Step-by-Step: Updating Using docker-compose

!!! tip
    You **must** run these commands in the same folder where `docker-compose.yml` exists.  
    Running docker-compose elsewhere will not affect this service.

```bash
cd ~/app-folder
docker-compose pull
docker-compose down
docker-compose up -d
```

### What these commands do

| Command | Meaning |
|--------|---------|
| `docker-compose pull` | Downloads the newest version of the image |
| `docker-compose down` | Stops & removes the old container (but **not** your mounted data) |
| `docker-compose up -d` | Starts a new container using the updated image |

---

## Verify That the Update Worked

```bash
docker ps --format "table {{.Names}}\t{{.Image}}\t{{.Status}}"
```

!!! example
    If your app exposes a UI, open it in a browser and check the version label.

---

## Optional: Back Up Your Data (Extra Safety)

```bash
cp -a storage storage_backup_$(date +%Y%m%d)
```

!!! tip
    This creates a full copy of your data folder. It is safe but optional before updates.

---

## Clean Up Old Images (Reclaim Disk Space)

Once you've confirmed everything is working:

```bash
docker image prune -f
```

Or delete only unused images:

```bash
docker rmi $(docker images -f "dangling=true" -q)
```

!!! warning
    Do **not** prune images *before* confirming the application starts and data is intact.

---

## Multiple Docker Apps on One Server

Each app lives in its own folder.  
To update one, you must `cd` into its directory:

```
~/anythingllm      → updating here affects AnythingLLM only
~/n8n              → updating here affects n8n only
~/myapp            → updating here affects only that app
```

---

## TL;DR

```
cd ~/app-folder
docker-compose pull
docker-compose down
docker-compose up -d
# optional after confirming
docker image prune -f
```
