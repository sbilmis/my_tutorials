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

* **Parallelization:** Unlike `zenodo_get`, `aria2c` can download 16+ files simultaneously.
* **Connection Splitting:** It opens multiple connections per file to maximize bandwidth.
* **Resumability:** Excellent support for resuming interrupted downloads.

### Step A: Generate the URL List

We still use `zenodo_get` to fetch the download links, but we save them to a file instead of downloading the data.

```bash
zenodo_get 17725827 -w urls.txt

```

### Step B: Parallel Download (With Browser Spoofing)

Zenodo frequently blocks automated download managers with `403 Forbidden` errors. To avoid this, we **must** trick the server into thinking we are a standard web browser by setting the User-Agent.

Run the following command:

```bash
aria2c -c -i urls.txt -j 16 -x 16 \
-U "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36"
```

**Flag explanation:**

* `-c`: **Continue** (Resume). This is critical. If the download stops, this flag ensures it picks up exactly where it left off.
* `-i urls.txt`: Input file containing the list of URLs.
* `-j 16`: **Parallel Downloads.** Download 16 files simultaneously.
* `-x 16`: **Max Connections.** Use 16 connections per single file.
* `-U "..."`: **User-Agent.** Spoofs a Chrome browser to prevent 403 errors.

### 🆘 Troubleshooting: How to Resume?

If your internet cuts out or you accidentally close the terminal:

1. **Do not panic.** `aria2c` is designed for this.
2. Simply **run the exact same command again**.
* Thanks to the `-c` flag, it will verify the existing files, skip the completed ones, and resume the partial ones.



---

## 5. Method 3: The "Sysadmin" Way (GNU Parallel / xargs)

If you are on a restricted server where you cannot install `aria2c` or Python packages, you can use standard Linux tools (`wget` and `xargs`) to achieve parallel downloads.

### The Command

This command reads the URL list and spawns 8 separate `wget` processes at once.

```bash
cat urls.txt | xargs -n 1 -P 8 wget -q -c
```

**Flag explanation:**

* `xargs`: A tool to build and execute command lines from standard input.
* `-n 1`: Use 1 URL per command.
* `-P 8`: **Parallelism.** Run up to 8 processes at the same time.
* `wget -c`: The standard download tool with the **continue** flag enabled.

!!! tip "Performance Note"
This method is heavier on system resources (CPU/RAM) than `aria2c` because it launches 8 full instances of `wget`. Use it only if `aria2c` is unavailable.

---

## 6. Handling the Data: Read vs. Extract

After downloading, you will have several large `.tar` files.

### Option A: Recommended (Do NOT Extract)

!!! danger "STOP: Do NOT untar everything"
* **Risk:** 330GB of archives expands to **>9TB** when extracted.
* **Result:** You may exceed quotas or crash the filesystem.
* **Best practice:** Stream data directly from `.tar` files.

Many analysis scripts can read compressed archives directly, avoiding massive disk usage.

### Option B: If You MUST Extract (Advanced)

Only proceed if you have **>10TB free space** and a strict requirement to extract files.

**Safe extraction script:**

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

If Python is unavailable, you can query the Zenodo API directly to generate your `urls.txt`.

```bash
curl -s [https://zenodo.org/api/records/17725827](https://zenodo.org/api/records/17725827) \
| grep -oP '[https://zenodo.org/api/records/17725827/files/](https://zenodo.org/api/records/17725827/files/)[^"]+' \
> urls.txt
```

---

## 🧠 Knowledge Check

### Challenge 1: Why did my download fail with 403?

??? question "Answer"
Zenodo likely detected your script as a bot. You must add a **User-Agent** string (`-U "Mozilla/..."`) to your `aria2c` command to pretend you are a browser.

### Challenge 2: How do I resume an interrupted download?

??? question "Answer"
Just run the command again! Ensure the `-c` (continue) flag is included. `aria2c` will automatically skip finished files and finish the partial ones.

