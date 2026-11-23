import * as fs from "fs";
import * as path from "path";
import * as crypto from "crypto";

export interface UpdateProgress {
  jobId: string;
  type: "checking" | "downloading" | "applying" | "rebuilding" | "complete" | "error";
  progress: number;
  message: string;
  details?: string;
}

export interface UpdateInfo {
  hasUpdate: boolean;
  currentVersion: string;
  latestVersion: string;
  changedFiles: number;
  repoUrl: string;
}

type ProgressCallback = (progress: UpdateProgress) => void;

let currentProgress: UpdateProgress | null = null;

export function getLatestProgress(): UpdateProgress | null {
  return currentProgress;
}

export function clearProgress(): void {
  currentProgress = null;
}

const delay = (ms: number) => new Promise(r => setTimeout(r, ms));

function parseGitHubUrl(url: string): { owner: string; repo: string; branch: string } | null {
  const cleaned = url.trim().replace(/\.git$/, "").replace(/\/$/, "");

  const match = cleaned.match(/github\.com\/([^\/]+)\/([^\/\s#?]+)/);
  if (!match) return null;

  const branchMatch = cleaned.match(/\/tree\/([^\/\s#?]+)/);
  return {
    owner: match[1],
    repo: match[2],
    branch: branchMatch ? branchMatch[1] : "main",
  };
}

export function generateRepoFingerprint(owner: string, repo: string): string {
  return crypto.createHash("sha256").update(`${owner.toLowerCase()}/${repo.toLowerCase()}`).digest("hex").substring(0, 16);
}

export function verifyRepoFingerprint(owner: string, repo: string, storedFingerprint: string): boolean {
  return generateRepoFingerprint(owner, repo) === storedFingerprint;
}

async function fetchGitHubApi(endpoint: string): Promise<any> {
  console.log(`[Update] GitHub API: ${endpoint}`);
  const res = await fetch(`https://api.github.com${endpoint}`, {
    headers: {
      "Accept": "application/vnd.github.v3+json",
      "User-Agent": "DigitalMarketplace-Updater",
    },
  });
  if (!res.ok) {
    const text = await res.text();
    console.error(`[Update] GitHub API error (${res.status}): ${text.substring(0, 200)}`);
    throw new Error(`GitHub API error (${res.status}): ${text}`);
  }
  return res.json();
}

export async function validateGitHubRepo(repoUrl: string): Promise<{ valid: boolean; error?: string; owner?: string; repo?: string; branch?: string; fingerprint?: string }> {
  const parsed = parseGitHubUrl(repoUrl);
  if (!parsed) {
    return { valid: false, error: "Invalid GitHub URL format. Use: https://github.com/owner/repo" };
  }

  try {
    const repoData = await fetchGitHubApi(`/repos/${parsed.owner}/${parsed.repo}`);
    const fingerprint = generateRepoFingerprint(parsed.owner, parsed.repo);
    return { valid: true, ...parsed, owner: repoData.owner.login, repo: repoData.name, fingerprint };
  } catch (e: any) {
    if (e.message.includes("404")) {
      return { valid: false, error: "Repository not found. Make sure it's public or check the URL." };
    }
    return { valid: false, error: e.message };
  }
}

export async function checkForUpdates(repoUrl: string, currentCommit: string): Promise<UpdateInfo> {
  const parsed = parseGitHubUrl(repoUrl);
  if (!parsed) throw new Error("Invalid GitHub URL");

  const branchData = await fetchGitHubApi(`/repos/${parsed.owner}/${parsed.repo}/branches/${parsed.branch}`);
  const latestCommit = branchData.commit.sha;

  if (currentCommit === latestCommit) {
    return {
      hasUpdate: false,
      currentVersion: currentCommit.substring(0, 7),
      latestVersion: latestCommit.substring(0, 7),
      changedFiles: 0,
      repoUrl,
    };
  }

  let changedFiles = 0;
  if (currentCommit) {
    try {
      const comparison = await fetchGitHubApi(`/repos/${parsed.owner}/${parsed.repo}/compare/${currentCommit}...${latestCommit}`);
      changedFiles = comparison.files?.length || 0;
    } catch {
      changedFiles = -1;
    }
  }

  return {
    hasUpdate: true,
    currentVersion: currentCommit ? currentCommit.substring(0, 7) : "none",
    latestVersion: latestCommit.substring(0, 7),
    changedFiles,
    repoUrl,
  };
}

const IGNORE_PATTERNS = [
  /^\.git\//,
  /^node_modules\//,
  /^\.replit$/,
  /^replit\.nix$/,
  /^\.config\//,
  /^\.local\//,
  /^\.cache\//,
  /^dist\//,
  /^\.upm\//,
  /^replit\.md$/,
  /^package-lock\.json$/,
  /^migrations\//,
  /^\.env/,
  /^attached_assets\//,
  /^generated\//,
  /^\.update_staging\//,
  /^\.update_backup\//,
];

const TRACKED_DIRS = ["client", "server", "shared"];

function shouldIgnoreFile(filePath: string): boolean {
  return IGNORE_PATTERNS.some(pattern => pattern.test(filePath));
}

function getLocalTrackedFiles(baseDir: string): string[] {
  const results: string[] = [];

  function walk(dir: string) {
    try {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        const relativePath = path.relative(baseDir, fullPath);
        if (shouldIgnoreFile(relativePath)) continue;
        if (entry.isDirectory()) {
          walk(fullPath);
        } else {
          results.push(relativePath);
        }
      }
    } catch {}
  }

  for (const tracked of TRACKED_DIRS) {
    const trackedPath = path.join(baseDir, tracked);
    if (fs.existsSync(trackedPath)) {
      walk(trackedPath);
    }
  }

  return results;
}

export async function applyUpdate(
  repoUrl: string,
  jobId: string,
  onProgress: ProgressCallback
): Promise<{ success: boolean; filesUpdated: number; newCommit: string; error?: string }> {
  const parsed = parseGitHubUrl(repoUrl);
  if (!parsed) throw new Error("Invalid GitHub URL");

  const emit = async (p: UpdateProgress) => {
    currentProgress = p;
    onProgress(p);
    await delay(50);
  };

  const emitRange = async (from: number, to: number, type: UpdateProgress["type"], message: string, details?: string) => {
    for (let pct = from; pct <= to; pct++) {
      await emit({ jobId, type, progress: pct, message, details });
    }
  };

  const { execSync } = await import("child_process");
  const isProduction = process.env.NODE_ENV === "production";
  const baseDir = process.cwd();
  const stagingDir = path.join(baseDir, ".update_staging");

  const execEnv = {
    ...process.env,
    PATH: `${path.join(baseDir, "node_modules", ".bin")}:${process.env.PATH || ""}`,
  };

  try {
    await emitRange(1, 3, "checking", "Verifying repository...");

    const branchData = await fetchGitHubApi(`/repos/${parsed.owner}/${parsed.repo}/branches/${parsed.branch}`);
    const latestCommit = branchData.commit.sha;

    await emitRange(4, 7, "downloading", "Fetching file tree from GitHub...");

    const tree = await fetchGitHubApi(`/repos/${parsed.owner}/${parsed.repo}/git/trees/${latestCommit}?recursive=1`);
    const files = tree.tree.filter((f: any) => f.type === "blob" && !shouldIgnoreFile(f.path));
    const totalFiles = files.length;

    await emitRange(8, 10, "downloading", `Found ${totalFiles} files to download...`);

    if (fs.existsSync(stagingDir)) {
      fs.rmSync(stagingDir, { recursive: true, force: true });
    }
    fs.mkdirSync(stagingDir, { recursive: true });

    let filesDownloaded = 0;
    let downloadErrors = 0;
    const batchSize = 5;
    let lastReportedPct = 10;

    for (let i = 0; i < files.length; i += batchSize) {
      const batch = files.slice(i, i + batchSize);

      const results = await Promise.all(
        batch.map(async (file: any) => {
          try {
            const content = await fetchFileContent(parsed.owner, parsed.repo, file.path, parsed.branch);
            const stagingPath = path.join(stagingDir, file.path);
            const dir = path.dirname(stagingPath);
            if (!fs.existsSync(dir)) {
              fs.mkdirSync(dir, { recursive: true });
            }
            fs.writeFileSync(stagingPath, content, "utf-8");
            return "downloaded";
          } catch (err) {
            console.error(`[Update] Failed to download ${file.path}:`, err);
            return "error";
          }
        })
      );

      results.forEach((r) => {
        if (r === "downloaded") filesDownloaded++;
        else downloadErrors++;
      });

      const processed = Math.min(i + batchSize, files.length);
      const progressPct = Math.round(10 + (processed / totalFiles) * 50);
      const detailsStr = `${filesDownloaded} downloaded${downloadErrors > 0 ? `, ${downloadErrors} errors` : ""}`;

      if (progressPct > lastReportedPct) {
        await emitRange(
          lastReportedPct + 1,
          progressPct,
          "downloading",
          `Downloading files... (${processed}/${totalFiles})`,
          detailsStr
        );
        lastReportedPct = progressPct;
      }
    }

    if (downloadErrors > totalFiles * 0.1) {
      fs.rmSync(stagingDir, { recursive: true, force: true });
      await emit({ jobId, type: "error", progress: 60, message: `Too many download errors (${downloadErrors}/${totalFiles}). Update aborted.` });
      return { success: false, filesUpdated: 0, newCommit: latestCommit, error: `${downloadErrors} files failed to download` };
    }

    await emitRange(61, 63, "downloading", `All files downloaded (${filesDownloaded}/${totalFiles})`);

    await emitRange(64, 66, "applying", "Preparing staged build...");

    const stagingPackageJson = path.join(stagingDir, "package.json");
    if (fs.existsSync(stagingPackageJson)) {
      fs.copyFileSync(stagingPackageJson, path.join(baseDir, "package.json"));
    }

    await emitRange(67, 72, "rebuilding", "Installing dependencies...");

    try {
      execSync("npm install --legacy-peer-deps --include=dev", {
        cwd: baseDir,
        timeout: 180000,
        stdio: "pipe",
        env: execEnv,
      });
    } catch (installErr: any) {
      const errMsg = installErr.stderr?.toString() || installErr.message || "Unknown install error";
      console.error("[Update] npm install failed:", errMsg);
      fs.rmSync(stagingDir, { recursive: true, force: true });
      await emit({ jobId, type: "error", progress: 72, message: `npm install failed: ${errMsg.substring(0, 200)}` });
      return { success: false, filesUpdated: 0, newCommit: latestCommit, error: errMsg };
    }

    const backupDir = path.join(baseDir, ".update_backup");

    await emitRange(73, 75, "applying", "Backing up current files...");

    if (fs.existsSync(backupDir)) {
      fs.rmSync(backupDir, { recursive: true, force: true });
    }
    fs.mkdirSync(backupDir, { recursive: true });

    const allLocalFiles = getLocalTrackedFiles(baseDir);
    const backedUpFiles: string[] = [];
    for (const filePath of allLocalFiles) {
      try {
        const localPath = path.resolve(baseDir, filePath);
        if (fs.existsSync(localPath)) {
          const backupPath = path.join(backupDir, filePath);
          const dir = path.dirname(backupPath);
          if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
          }
          fs.copyFileSync(localPath, backupPath);
          backedUpFiles.push(filePath);
        }
      } catch {}
    }

    await emitRange(76, 78, "applying", "Applying file updates...");

    for (const file of files) {
      try {
        const stagingPath = path.join(stagingDir, file.path);
        if (!fs.existsSync(stagingPath)) continue;
        const localPath = path.resolve(baseDir, file.path);
        const newContent = fs.readFileSync(stagingPath, "utf-8");
        const dir = path.dirname(localPath);
        if (!fs.existsSync(dir)) {
          fs.mkdirSync(dir, { recursive: true });
        }
        fs.writeFileSync(localPath, newContent, "utf-8");
      } catch {}
    }

    if (isProduction) {
      await emitRange(79, 84, "rebuilding", "Building production bundle...");
      try {
        execSync("npx tsx script/build.ts", {
          cwd: baseDir,
          timeout: 180000,
          stdio: "pipe",
          env: execEnv,
          shell: "/bin/sh",
        });
      } catch (buildErr: any) {
        const errMsg = buildErr.stderr?.toString() || buildErr.message || "Unknown build error";
        console.error("[Update] npm run build failed, restoring backup...");

        const currentTracked = getLocalTrackedFiles(baseDir);
        const backedUpSet = new Set(backedUpFiles);
        for (const curFile of currentTracked) {
          if (!backedUpSet.has(curFile)) {
            try {
              const fullPath = path.resolve(baseDir, curFile);
              fs.unlinkSync(fullPath);
              const dir = path.dirname(fullPath);
              try { const r = fs.readdirSync(dir); if (r.length === 0) fs.rmdirSync(dir); } catch {}
            } catch {}
          }
        }

        for (const filePath of backedUpFiles) {
          try {
            const backupPath = path.join(backupDir, filePath);
            const localPath = path.resolve(baseDir, filePath);
            if (fs.existsSync(backupPath)) {
              const dir = path.dirname(localPath);
              if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
              fs.copyFileSync(backupPath, localPath);
            }
          } catch {}
        }

        try { fs.rmSync(backupDir, { recursive: true, force: true }); } catch {}
        try { fs.rmSync(stagingDir, { recursive: true, force: true }); } catch {}

        await emit({ jobId, type: "error", progress: 84, message: `Build failed — files restored to previous version. ${errMsg.substring(0, 200)}` });
        return { success: false, filesUpdated: 0, newCommit: latestCommit, error: errMsg };
      }
    }

    try { fs.rmSync(backupDir, { recursive: true, force: true }); } catch {}

    await emitRange(85, 87, "applying", "Cleaning up removed files...");

    const remoteFilePaths = new Set(files.map((f: any) => f.path));
    const localFiles = getLocalTrackedFiles(baseDir);
    let filesRemoved = 0;
    const filesUpdated = filesDownloaded;

    for (const localFile of localFiles) {
      if (!remoteFilePaths.has(localFile)) {
        try {
          const fullPath = path.resolve(baseDir, localFile);
          fs.unlinkSync(fullPath);
          filesRemoved++;

          const dir = path.dirname(fullPath);
          try {
            const remaining = fs.readdirSync(dir);
            if (remaining.length === 0) fs.rmdirSync(dir);
          } catch {}
        } catch {}
      }
    }

    if (filesRemoved > 0) {
      await emit({ jobId, type: "applying", progress: 88, message: `Removed ${filesRemoved} obsolete files`, details: `${filesUpdated} updated, ${filesRemoved} removed` });
    }

    await emitRange(89, 93, "rebuilding", "Syncing database schema...");

    try {
      execSync("npx drizzle-kit push --force", {
        cwd: baseDir,
        timeout: 60000,
        stdio: "pipe",
        env: execEnv,
      });
    } catch (dbErr: any) {
      const errMsg = dbErr.stderr?.toString() || dbErr.message || "Unknown DB sync error";
      console.error("[Update] drizzle-kit push failed:", errMsg);
    }

    await emitRange(94, 97, "rebuilding", "Cleaning up staging files...");

    try {
      fs.rmSync(stagingDir, { recursive: true, force: true });
    } catch {}

    await emitRange(98, 99, "rebuilding", "Finalizing update...");

    const removedInfo = filesRemoved > 0 ? `, ${filesRemoved} removed` : "";
    const restartNote = isProduction ? " Server will restart shortly." : "";
    await emit({
      jobId,
      type: "complete",
      progress: 100,
      message: `Update complete! ${filesUpdated} files updated${removedInfo}.${restartNote}`,
      details: `Version: ${latestCommit.substring(0, 7)}`,
    });

    if (isProduction) {
      setTimeout(() => {
        try {
          execSync("pm2 restart all", { stdio: "pipe", timeout: 10000 });
        } catch {
          console.log("[Update] pm2 restart failed, exiting process for auto-restart...");
          process.exit(0);
        }
      }, 3000);
    }

    return { success: true, filesUpdated, newCommit: latestCommit };
  } catch (error: any) {
    try {
      if (fs.existsSync(stagingDir)) {
        fs.rmSync(stagingDir, { recursive: true, force: true });
      }
    } catch {}
    await emit({
      jobId,
      type: "error",
      progress: 0,
      message: `Update failed: ${error.message}`,
    });
    return { success: false, filesUpdated: 0, newCommit: "", error: error.message };
  }
}

async function fetchFileContent(owner: string, repo: string, filePath: string, branch: string): Promise<string> {
  const url = `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/${filePath}`;
  const res = await fetch(url, {
    headers: { "User-Agent": "DigitalMarketplace-Updater" },
  });
  if (!res.ok) throw new Error(`Failed to fetch ${filePath}`);
  return res.text();
}
