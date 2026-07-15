# Tutorial: How to Download Massive Datasets from Zenodo

!!! abstract "Overview"
    * **Goal:** Download the OpenAIRE Graph dataset (~380GB as of v11.1.1, and growing each release) safely.
    * **Time Required:** ~10 minutes to set up (download time depends on bandwidth; budget a day at a single stream).
    * **Skill Level:** Beginner / Intermediate.
    * **Prerequisites:** Access to a terminal (Linux/macOS) and ~400GB of free disk space.
    * **Tools Used:** `zenodo_get` (for link generation), `aria2c` (recommended), or standard `xargs`.

This guide explains how to reliably download massive datasets (100GB to terabytes) from Zenodo to a local server or a High-Performance Computing (HPC) cluster.

As a practical example, we will be using the **OpenAIRE Graph** dataset (~380GB), but these methods apply to any large Zenodo record (e.g., climate data, genomic sequences, or large text corpora).

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

### Step A: Generate the URL List

There are multiple ways to generate the list of file URLs (`urls.txt`).  
Choose the one that best fits your environment.

---

#### Option 1 (Recommended): Using `zenodo_get`

This is the safest and simplest method if Python is available.

```bash
zenodo_get <RECORD_ID> -w urls.txt
```

This command **only writes the download links** without downloading any data.

---

#### Option 2: Directly via the Zenodo API (Using `jq`)

If Python is unavailable but `jq` exists (common on macOS and modern Linux systems), you can query the Zenodo API directly.

```bash
curl -s https://zenodo.org/api/records/<RECORD_ID> \
| jq -r '.files[].links.self' \
> urls.txt
```

**Why this works well:**
- Fully JSON-aware (no fragile regex)
- Cross-platform (macOS, Linux, HPC nodes)
- Robust against formatting changes

---

#### Option 3: Directly via the Zenodo API (POSIX-compatible `grep`)

If neither Python nor `jq` is available, you can fall back to standard tools.
This version works on both GNU/Linux and macOS (BSD `grep`).

```bash
curl -s https://zenodo.org/api/records/<RECORD_ID> \
| grep -oE 'https://zenodo.org/api/records/<RECORD_ID>/files/[^"]+' \
> urls.txt
```

!!! warning "Why not grep -P?"
    The `-P` (Perl regex) flag is **not supported** by BSD `grep` on macOS and is often disabled on HPC systems.  
    Always prefer `grep -E` or `jq` for portability.

---

Once `urls.txt` is generated, proceed to **Step B** and start the parallel download with `aria2c`.If you prefer a fully automated workflow without parallel downloads, you can also let `zenodo_get` download the files directly.

---

### Step B: Identify the Record ID

Throughout this guide, **`<RECORD_ID>`** is a placeholder for the numeric ID in the dataset's Zenodo URL — replace it with the record you actually want (e.g. `20428976` for OpenAIRE Graph v11.1.1).

* Example URL: `https://zenodo.org/records/20428976`
* Record ID: `20428976`

### Step C: Download Command

```bash
zenodo_get <RECORD_ID> -R 5 -p 2
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
zenodo_get <RECORD_ID> -w urls.txt

```

### Step B: Parallel Download (With Browser Spoofing)

Zenodo protects its infrastructure with a Web Application Firewall (WAF) that returns `403 Forbidden` to clients that look automated. The core trick is to send a **current** browser User-Agent so the server treats you like a real browser.

```bash
aria2c -c -i urls.txt -j 16 -x 16 \
  -U "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36"
```

**Flag explanation:**

* `-c`: **Continue** (Resume). Critical — if the download stops, it picks up exactly where it left off.
* `-i urls.txt`: Input file containing the list of URLs.
* `-j 16`: **Parallel Downloads.** Download 16 files simultaneously.
* `-x 16`: **Max Connections.** Use 16 connections per single file.
* `-U "..."`: **User-Agent.** Must look like a *modern* browser (see the warning below).

!!! danger "This command alone may still fail — read Section 4.5 first"
    The high-speed command above works from a **clean IP with a current User-Agent**, but two separate problems can still produce a `403 Forbidden`: a **stale User-Agent** and **too much parallelism**. They need different fixes. If you hit a `403` — especially one that says *"unusual traffic from your network"* — go to [Section 4.5](#45-the-403-forbidden-trap-two-causes) before spending hours debugging (I did).

---


## 4.5 The `403 Forbidden` Trap: Two Causes

When you script a large Zenodo download, `403 Forbidden` almost always means one of **two different things**. The body of the error page tells you which — a rate-block reads:

> *"Access to this resource has been restricted due to unusual traffic from your network."*

### Cause 1 — Stale / bot-like User-Agent

Zenodo blocks obvious download-manager User-Agents. The classic fix is to spoof a browser (Step B above) — **but the User-Agent must be current.**

!!! danger "Old User-Agent strings are now flagged too"
    The `Chrome/91` string that circulated in older guides (including earlier versions of *this* tutorial) is now itself a known bot signature and gets a `403` **even from a clean, un-blocked IP**. Use a **recent** Chrome version:
    ```
    Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36
    ```
    In one multi-hour failure, swapping the old UA for a modern one was the **single** fix — same IP, same URL, same second: the old UA got `403`, the new UA got `206 OK`.

### Cause 2 — Too much parallelism (whole-IP rate-block)

The `-j 16 -x 16` command opens **up to 256 simultaneous connections**. Zenodo's WAF reads that as "unusual traffic" and blocks your entire **public IP**. This block:

- is **per-IP** — switching Wi-Fi only helps if the new network actually has a *different* public IP (many don't, due to shared ISP/CGNAT — check with `curl -s https://api.ipify.org`);
- is **sticky**, lasting minutes to hours;
- **escalates** each time you re-trigger it, so hammering retries makes it *worse*.

!!! tip "Diagnose before every retry"
    This one-liner prints your public IP **and** whether that IP/UA combination is currently blocked. Run it before starting — only proceed on `CLEAN` (replace `<RECORD_ID>`, e.g. `20428976` for v11.1.1):
    ```bash
    echo "IP: $(curl -s https://api.ipify.org)"
    curl -s -A "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36" \
      -o /tmp/z -w "HTTP %{http_code}\n" -r 0-0 \
      "https://zenodo.org/records/<RECORD_ID>/files/software.tar"
    grep -q "unusual traffic" /tmp/z && echo ">>> BLOCKED on this IP/UA" || echo ">>> CLEAN — safe to start"
    ```

### The reliable recipe: trade speed for reliability

If you keep hitting Cause 2, stop fighting the WAF — download **one connection, one file at a time**. It is slower but it actually finishes without re-arming the block. This is what reliably completed a ~380 GB pull after the parallel command kept getting blocked:

```bash
aria2c -c -i urls.txt \
  --max-concurrent-downloads=1 \
  --max-connection-per-server=1 \
  --split=1 \
  -U "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36"
```

!!! note "Rule of thumb for 2026"
    Start **gentle** (sequential, modern UA). Only scale up to `-j`/`-x` if the server tolerates it. A block that has escalated can cost you hours, so it is not worth racing into.

---

## 4.6 A Self-Healing Download Script

For a hands-off run that survives WAF blocks, dropped connections, and reboots, wrap `aria2c` in a loop that **probes first** (so it never hammers a blocking server), **backs off** when blocked, and **auto-resumes**. Save as `download.sh` next to your `urls.txt`, then run it (see below).

```bash
#!/bin/bash
# Resumable, WAF-resilient, sequential Zenodo download.
# Re-run any time: finished files are skipped, partial files continue (aria2 -c).
cd "$(dirname "$0")" || exit 1

UA="Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36"
PROBE_URL="https://zenodo.org/records/<RECORD_ID>/files/software.tar"  # <RECORD_ID> e.g. 20428976 (v11.1.1); any small file in the record
BACKOFF=1200   # seconds to wait when blocked, before probing again

log() { echo "$(date '+%F %T') $*" | tee -a download_wrapper.log; }

# Returns 0 only if the server actually serves us (HTTP 200/206).
preflight() {
  local code
  code=$(curl -s -o /dev/null -w '%{http_code}' -A "$UA" --max-time 30 -r 0-0 "$PROBE_URL")
  [ "$code" = "200" ] || [ "$code" = "206" ]
}

while true; do
  if ! preflight; then
    log "WAF blocking (or unreachable); waiting ${BACKOFF}s"
    sleep "$BACKOFF"; continue
  fi
  log "preflight OK — launching aria2 (sequential)"
  aria2c -c -i urls.txt \
    --max-concurrent-downloads=1 --max-connection-per-server=1 --split=1 \
    --max-tries=5 --retry-wait=60 --auto-save-interval=30 \
    -U "$UA" --console-log-level=warn
  rc=$?
  [ "$rc" -eq 0 ] && { log "=== ALL FILES DONE ==="; break; }
  log "aria2 stopped (rc=$rc); backing off ${BACKOFF}s then resuming"
  sleep "$BACKOFF"
done
```

Run it so it survives a closed terminal and keeps the machine awake:

```bash
chmod +x download.sh
caffeinate -s nohup ./download.sh > run.out 2>&1 &   # macOS; on Linux drop 'caffeinate -s'
tail -f download_wrapper.log                          # watch progress
```

!!! tip "Even stronger: let aria2 verify each file as it lands"
    aria2's input-file format accepts a per-file checksum. If you build the input with `out=` and `checksum=md5=...` lines (from the Zenodo API's `.files[].checksum`), aria2 verifies every file on completion and re-downloads any that fail — no separate pass needed.

---

## 4.7 Verify the Download

Never trust a multi-hundred-GB download without checking it. Zenodo publishes an MD5 for every file (replace `<RECORD_ID>`, e.g. `20428976` for v11.1.1):

```bash
# Build md5sums.txt from the Zenodo API (filename + hash), then verify:
curl -s https://zenodo.org/api/records/<RECORD_ID> \
  | jq -r '.files[] | "\(.checksum | sub("md5:";""))  \(.key)"' > md5sums.txt

md5sum -c md5sums.txt      # every line should print "OK"
```

!!! note "macOS note"
    macOS ships `md5`, not `md5sum`. Install GNU coreutils (`brew install coreutils`) to get `md5sum`, or verify individual files with `md5 -r file.tar` and compare by eye.

---

## 🖥️ HPC Etiquette: Using `aria2c` Responsibly on Shared Systems

When running `aria2c` on an HPC cluster or shared institutional server, **performance is not the only concern**.  
You must also avoid negatively impacting other users and shared infrastructure.

!!! warning "HPC systems are shared environments"
    Aggressive download settings may overload:
    - Shared login nodes
    - Shared filesystems (Lustre, GPFS, NFS)
    - Institutional network links

### Recommended Settings for HPC Login Nodes

```bash
aria2c -c -i urls.txt \
  -j 4 \
  -x 4 \
  --file-allocation=trunc \
  --auto-save-interval=60 \
  --summary-interval=60 \
  -U "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36"
```

### Key Etiquette Rules

- **Limit parallel files (`-j`)**
  - Login node: `-j 2–4`
  - Dedicated transfer node: `-j 8–16`
- **Avoid excessive connections per file**
  - `-x 4` is usually sufficient
- **Never run heavy downloads on compute nodes**
  - Use login or data-transfer nodes only
- **Prefer local scratch or fast storage**
  - Avoid direct downloads into shared home directories
- **Throttle if necessary**
  ```bash
  --limit-overall-rate=50M
  ```

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


## 🧠 Knowledge Check

Test your understanding of the workflow.  
**Click each question to reveal the answer.**

---

### ❓ Challenge 1: How can you generate download links without downloading any data?

??? answer "Show answer"
    ```bash
    zenodo_get <RECORD_ID> -w links.txt
    grep "communities_infrastructures.tar" links.txt
    ```

    This writes all file URLs to `links.txt` and allows you to inspect or filter them before downloading.

---

### ❓ Challenge 2: How do you download only a single file from the dataset?

??? answer "Show answer"
    ```bash
    aria2c -x 10 -s 10 \
      -U "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36" \
      <URL>
    ```

    This is useful for testing connectivity or downloading a small subset of the dataset.

---

### ❓ Challenge 3: How can you safely test archive extraction?

??? answer "Show answer"
    ```bash
    mkdir test_extract
    tar -xf communities_infrastructures.tar -C test_extract
    ls -l test_extract
    ```

    Always test extraction on **one archive** before attempting any large-scale unpacking.

---

### ❓ Challenge 4: Why did your download fail with a `403 Forbidden` error?

??? answer "Show answer"
    There are **two** possible causes (see [Section 4.5](#45-the-403-forbidden-trap-two-causes)):

    1. **Stale / bot-like User-Agent.** Add a *current* browser UA — an old one (e.g. `Chrome/91`) is now itself flagged:
       ```bash
       -U "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36"
       ```
    2. **Too much parallelism.** If the error page says *"unusual traffic from your network,"* your whole IP is rate-blocked. A User-Agent won't help — reduce parallelism (go sequential), wait for the block to clear, or move to a genuinely different IP (a phone hotspot is the fastest clean IP).

    Diagnose which one you have with the probe one-liner in Section 4.5.

## ✅ Takeaway

- Use `zenodo_get` for **simplicity**
- Use `aria2c` for **performance**
- Keep your **User-Agent current** — a stale one (e.g. `Chrome/91`) is now blocked on its own
- If you see *"unusual traffic"*, it's an **IP rate-block**: go **sequential**, wait, or change IP — a User-Agent won't fix it
- **Verify** with `md5sum -c` before trusting the data
- Respect **HPC etiquette**
- Never extract massive archives blindly
