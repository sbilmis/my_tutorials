# Tutorial: How to Download Massive Datasets from Zenodo

!!! abstract "Overview"
    * **Goal:** Download the 330GB OpenAIRE Graph dataset safely.
    * **Time Required:** ~10 minutes to set up (Download time depends on bandwidth).
    * **Skill Level:** Beginner / Intermediate.
    * **Prerequisites:** Access to a terminal (Linux/Mac) and ~350GB of free disk space.
    * **Tools Used:** `zenodo_get`, `aria2c`, or `wget`.

This guide explains how to reliably download massive datasets (100GB to Terabytes) from Zenodo to a local server or High-Performance Computing (HPC) cluster.

As a practical example, we will be using the **OpenAIRE Graph** dataset (~330GB), but these methods apply to any large Zenodo record (e.g., climate data, genomic sequences, or large corpus text dumps).

## 1. Context: What are we downloading?

### **What is Zenodo?**
Zenodo is an open-access repository developed under the European OpenAIRE program and operated by CERN. It hosts datasets, software, and reports from *any* field of research. It is widely used because it issues a persistent DOI (Digital Object Identifier) for every record.

### **The Example: OpenAIRE Graph**
In this tutorial, we are downloading the **OpenAIRE Graph**, one of the world's largest open scholarly knowledge graphs. It connects millions of publications, datasets, software, and funding records.

* **Note on "Freshness":** Massive datasets on Zenodo are often **static snapshots**. For example, the OpenAIRE Graph dump is published every 6 months. While live portals (like OpenAIRE EXPLORE) show real-time data, the Zenodo dump is the standard source for researchers needing a stable, offline version of the entire database.

---

## 2. The "Golden Rule" of Large Downloads

!!! danger "Stop: Do NOT use the 'Download All' button"
    Zenodo attempts to zip the files on the fly. For a 330GB dataset, this process 
    will time out, fails to support resuming, and gives you no way to verify checksums.
    **Always download the files individually.**

On any Zenodo record page, you will see a button labeled "Download all" that points to a `files-archive` link.

* **Why avoid it?** Zenodo attempts to zip hundreds of gigabytes on-the-fly into a single stream. This almost always fails due to network timeouts or browser limits.
* **The Consequence:** It cannot be resumed. If it fails at 99%, you lose everything.

**The Solution:** Always download the files individually. The instructions below show you how to automate this.

---

## 3. Method 1: The Easiest Way (`zenodo_get`)

The community has created a dedicated Python tool called `zenodo_get`. This is the recommended method for most users because it handles the file list, retries, and checksum verification automatically.

### **Step A: Installation**
You need Python installed. Run this in your terminal:

```bash
pip install zenodo-get
```


### **Step B: Identify the Record ID**

You only need the **Record ID** from the URL of your dataset.

* *Example URL:* `https://zenodo.org/records/17725827`
* *Record ID:* `17725827`

### **Step C: The Robust Download Command**

Run the following command. We will add flags to handle network blips automatically.

```bash
zenodo_get 17725827 -R 5 -p 2

```

**What do these flags do?**

* `17725827`: The ID of the dataset you want.
* `-R 5`: **Retry limit.** If a file fails to download, the tool will try 5 more times before giving up.
* `-p 2`: **Pause.** It will wait 2 seconds between retries to let the connection stabilize.

### **How to Resume if it crashes?**

If your internet drops completely and the script stops, simply run the **exact same command** again.

* The tool checks the folder.
* If a file exists and is complete (verified by MD5), it skips it.
* If a file is missing or corrupt, it downloads it again.

---

## 4. Method 2: The High-Speed Way (`aria2c`)

If you have a fast internet connection but it is unstable, or if you want to maximize speed, `aria2c` is often superior to standard tools because it supports **parallel connections**.

### Advantages of `aria2c`

* **Parallel Connections:** It opens multiple connections per file (like a torrent), filling your bandwidth pipe more effectively than a single stream.
* **Robustness:** It handles dropouts extremely well.

### Step A: Get the Links first

Use `zenodo_get` just to generate the list of URLs, without downloading the data yet.

```bash
# -w creates a text file of URLs
zenodo_get 17725827 -w urls.txt

```

### Step B: Download with `aria2c`

Feed the URL list into `aria2c`:

```bash
aria2c -i urls.txt -x 10 -c

```

* `-i urls.txt`: The input file containing the list of links.
* `-x 10`: **Max Connections.** Uses up to 10 connections per file to speed up the download.
* `-c`: **Continue.** This is critical. If interrupted, running this command again resumes exactly where it stopped.

---

## 5. Method 3: The Standard Way (`wget`)

If you are on a strict university system where you cannot install Python or `aria2`, `wget` is likely already installed.

### Advantages of `wget`

* **Universally Available:** It is on almost every Linux server by default.
* **Stable:** It is single-threaded, which is friendlier to strict firewalls that might block the aggressive connection opening of `aria2c`.

### How to Download

First, you need the list of links (see "Expert Mode" below if you can't use `zenodo_get`). Then run:

```bash
wget -c -i urls.txt

```

* `-c`: **Continue.** This is the "resume" flag. Without it, `wget` will restart files from zero if the connection breaks.
* `-i`: **Input file.** Tells wget to read links from your text file.

---

## 6. Step 4: How to Handle the Data (Read vs. Extract)

Once the download is complete, you will have several massive `.tar` files. **Stop and read this before doing anything else.**

### Option A: The Recommended Way (Do NOT Extract)

!!! danger "STOP: Do NOT untar these files!"
	**You do not need to extract these files.**

	* **The Risk:** The compressed dataset is **~330GB**, but if you extract (untar) everything, it expands to **over 9TB** of JSON text. This will likely fill your storage quota immediately and crash the file system.
   * **The Solution:** Most modern analysis tools can read directly from compressed archives.



The example script provided in this repository (`count_tubitak_papers.py`) is designed to **stream** the data directly from the `.tar` files without ever extracting them to disk.

**Why this is better:**

* **Disk Space:** You only use the 330GB for the archives.
* **Efficiency:** The script reads the stream into memory buffer-by-buffer. It never creates the massive intermediate files.
* **Speed:** Reading one large `.tar` file is faster for the file system than reading millions of tiny `.json` files.

---

### **Option B: If you MUST Extract (Advanced)**

Only follow this step if you have **>10TB of free storage** and a specific software requirement that prevents reading from streams.

If you proceed, do **not** simply run `tar -xvf *.tar`. The archives contain millions of small files that will "explode" into your current directory, making it impossible to list files or clean up.

**The Safe Extraction Method:**
Use this script to unpack each tarball into its own dedicated subdirectory.

```bash
#!/bin/bash
# Loop through all .tar files in the current directory
for tarfile in *.tar; do
    # 1. Get the filename without the extension (e.g., 'publication_5')
    dirname="${tarfile%.tar}"
    
    # 2. Create a clean folder for this archive
    echo "Creating directory: $dirname"
    mkdir -p "$dirname"
    
    # 3. Extract the contents INTO that folder
    echo "Extracting $tarfile into $dirname..."
    tar -xf "$tarfile" -C "$dirname"
done

```

---

## 7. Expert Mode: Getting Links without `zenodo_get`

What if you are on a locked-down server with no Python/pip allowed, and you need to generate the `urls.txt` file manually? You can interact with the Zenodo API directly using `curl`.

### The Command

This one-liner fetches the metadata for the record, parses the JSON, and extracts the direct download links into a file named `urls.txt`.

```bash
curl -s "[https://zenodo.org/api/records/17725827](https://zenodo.org/api/records/17725827)" | grep -oP '[https://zenodo.org/api/records/17725827/files/](https://zenodo.org/api/records/17725827/files/)[^"]+' > urls.txt

```

* **Explanation:**
* `curl -s`: Fetches the data silently.
* `grep -oP`: Searches for the pattern of file URLs.
* `> urls.txt`: Saves the result to a file.



You can then feed this `urls.txt` into `wget` or `aria2c` as shown above.

```

```


---

## 🧠 Knowledge Check: Try it Yourself

Before you commit to downloading 330GB, let's practice the workflow on the smallest file in the dataset (`communities_infrastructures.tar` - 41 kB).

### Challenge 1: Get the specific link
How can you generate the list of URLs *without* starting the download, so you can find the link for the small file?

??? question "Click to see the solution"
    Use the `-w` (write URLs) flag with `zenodo_get`:

    ```bash
    # 1. Generate the list
    zenodo_get 17725827 -w links.txt
    
    # 2. Search for the specific file inside the list
    grep "communities_infrastructures.tar" links.txt
    ```

### Challenge 2: Download only the small file
Now that you have the link, how do you download *just* this file using `wget` or `aria2c`?

??? question "Click to see the solution"
    ```bash
    # Replace <URL> with the link you found in the previous step
    wget -c <URL>

	# Replace <URL> with the link you found in the previous step
    aria2c -x 10 -s 10 <URL>
    ```

### Challenge 3: The "Safe Extraction" Test
You now have `communities_infrastructures.tar`. How do you extract it **safely** into its own folder?

??? success "Click to see the best practice solution"
    Do not run `tar -xvf` in the root. Instead:

    ```bash
    # 1. Create the safe folder
    mkdir test_extract
    
    # 2. Extract into that folder
    tar -xf communities_infrastructures.tar -C test_extract
    
    # 3. Verify
    ls -l test_extract/
    ```
    *If you see a list of `.json` or `.gz` files inside, you are ready for the full dataset!*
