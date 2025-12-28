# Tutorial: How to Download Massive Datasets from Zenodo

!!! abstract "Overview"
    * **Goal:** Download the 330GB OpenAIRE Graph dataset safely.
    * **Time Required:** ~10 minutes to set up (download time depends on bandwidth).
    * **Skill Level:** Beginner / Intermediate.
    * **Prerequisites:** Access to a terminal (Linux/macOS) and ~350GB of free disk space.
    * **Tools Used:** `zenodo_get` (for link generation), `aria2c` (recommended), or standard `xargs`.

This guide explains how to reliably download massive datasets (100GB to terabytes) from Zenodo to a local server or a High-Performance Computing (HPC) cluster.

As a practical example, we will be using the **OpenAIRE Graph** dataset (~330GB), but these methods apply to any large Zenodo record (e.g., climate data, genomic sequences, or large text corpora).

---

## 1. Context: What are we downloading?

### What is Zenodo?
Zenodo is an open-access repository developed under the European OpenAIRE program and operated by CERN. It hosts datasets, software, and reports from *any* field of research and issues a persistent DOI for every record.

### The Example: OpenAIRE Graph
In this tutorial, we are downloading the **OpenAIRE Graph**, one of the world’s largest open scholarly knowledge graphs. It connects millions of publications, datasets, software, and funding records.

* **Note on freshness:** Massive datasets on Zenodo are usually **static snapshots**. For example, the OpenAIRE Graph dump is published roughly every six months. While live portals show real-time data, the Zenodo dump is the standard choice for stable, offline analysis.

---

## 2. The “Golden Rule” of Large Downloads

!!! danger "Do NOT use the “Download all” button"
    Zenodo attempts to zip the files on the fly. For a 330GB dataset, this process
    will time out, does not support resuming, and provides no checksum verification.
    **Always download files individually.**

On Zenodo record pages you may see a “Download all” button pointing to a `files-archive` link.

* **Why avoid it?** Zenodo tries to create a single huge zip stream on the fly.
* **Consequence:** If the download fails near the end, you must restart from zero.

**Solution:** Always download files individually using scripted tools.

---

## 3. Method 1: The Easiest Way (`zenodo_get`)

`zenodo_get` is a community-maintained Python tool that handles file lists, retries, and checksum verification automatically.

!!! warning "Limitation: No Parallel Downloads"
    `zenodo_get` downloads files **sequentially** (one by one). It cannot be parallelized to download multiple files at the same time. If you have many large files and high bandwidth, this method will be significantly slower than Method 2 (`aria2c`).

### Step A: Installation

```bash
pip install zenodo-get
```

### Step B: Identify the Record ID

You only need the **record ID** from the dataset URL.

* Example URL: `https://zenodo.org/records/17725827`
* Record ID: `17725827`

### Step C: Download Command

```bash
zenodo_get 17725827 -R 5 -p 2
```

**Flag explanation:**

* `-R 5`: Retry failed downloads up to 5 times.
* `-p 2`: Pause 2 seconds between retries.

---

## 4. Method 2: The Recommended High-Speed Way (`aria2c`)

For massive datasets, `aria2c` is superior because it supports **parallel operations** (downloading multiple files at once) and handles unstable connections robustly.

### Why use `aria2c`?

* **Parallelization:** Download multiple files simultaneously.
* **Connection Splitting:** Multiple TCP connections per file → full bandwidth usage.
* **Resumability:** If the connection drops, downloads **resume exactly where they left off**.
* **Browser Emulation:** Prevents Zenodo from blocking the request (403 errors).

### Step A: Generate the URL List

We still use `zenodo_get` to fetch the download links, but we save them to a file instead of downloading the data.

```bash
zenodo_get 17725827 -w urls.txt
```

---

### Step B: Robust Download (Recommended Command)

The following version is tuned for **unreliable connections** and **cluster environments**, where network hiccups, firewalls, and timeouts may occur.  
This combination worked perfectly even when the connection dropped multiple times:

```bash
aria2c -c -i urls.txt -j 2 -x 2 --retry-wait=30 -m 0 \
-U "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36"
```

### Why did this command succeed?

| Flag | Meaning | Why it matters |
|------|---------|----------------|
| `-c` | Continue / resume | Prevents restarting a 20GB file from scratch |
| `-i urls.txt` | Input file list | List of all files from Zenodo |
| `-j 2` | Download 2 files simultaneously | Low parallelism avoids firewall triggering and keeps RAM usage low |
| `-x 2` | Use 2 TCP connections per file | Balances speed + server friendliness |
| `--retry-wait=30` | Wait 30 sec before retry | Lets Zenodo cooldown when rate-limited |
| `-m 0` | Retry forever | Essential for HPC jobs where connection drops overnight |
| `-U "Mozilla..."` | Browser User-Agent spoofing | Prevents Zenodo bot-detection (403 errors) |

**In short:**  
This is slow-but-unbreakable mode.  
It is ideal for **unstable VPN**, **HPC login nodes**, **tailscale tunnels**, or **mobile hotspot** conditions.

---

### Optional — High-Bandwidth / Datacenter Version

If you are on a **fast server**, use:

```bash
aria2c -c -i urls.txt -j 16 -x 16 \
-U "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36"
```

---

## 5. Method 3: The "Sysadmin" Way (GNU Parallel / xargs)

If you are on a restricted server where you cannot install `aria2c` or Python packages, you can use standard Linux tools (`wget` and `xargs`) to achieve parallel downloads.

### The Command

```bash
cat urls.txt | xargs -n 1 -P 8 wget -q -c
```

!!! tip "Performance Note"
This method launches multiple `wget` processes → heavy CPU + RAM overhead.  
Use it only if `aria2c` is unavailable.

---

## 6. Handling the Data: Read vs. Extract

After downloading, you will have several large `.tar` files.

### Option A: Recommended (Do NOT Extract)

!!! danger "STOP: Do NOT untar everything"
* **Risk:** 330GB of archives expands to **>9TB** when extracted.
* **Result:** You may exceed quotas or crash the filesystem.
* **Best practice:** Stream data directly from `.tar` files.

### Option B: If You MUST Extract (Advanced)

```bash
#!/bin/bash
for tarfile in *.tar; do
    dirname="${tarfile%.tar}"
    mkdir -p "$dirname"
    tar -xf "$tarfile" -C "$dirname"
done
```

---

## 7. Expert Mode: Getting Links Without `zenodo_get`

```bash
curl -s https://zenodo.org/api/records/17725827 \
| grep -oP 'https://zenodo.org/api/records/17725827/files/[^"]+' \
> urls.txt
```

---

## 🧠 Knowledge Check

### Challenge 1: Generate Links Without Downloading

```bash
zenodo_get 17725827 -w links.txt
grep "communities_infrastructures.tar" links.txt
```

### Challenge 2: Download Only One Small File

```bash
aria2c -x 10 -s 10 -U "Mozilla/5.0..." <URL>
```

### Challenge 3: Safe Extraction Test

```bash
mkdir test_extract
tar -xf communities_infrastructures.tar -C test_extract
ls -l test_extract
```

### Challenge 4: Why did my download fail with 403?
Zenodo likely detected your script as a bot.  
**Fix:** Always add the browser `-U "Mozilla..."` flag.

---
