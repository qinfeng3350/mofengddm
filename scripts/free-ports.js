const { execSync } = require("node:child_process");
const os = require("node:os");

function safeExec(command) {
  try {
    return execSync(command, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
  } catch (error) {
    return `${error.stdout || ""}${error.stderr || ""}`;
  }
}

function parsePids(text) {
  const matches = text.match(/\b\d{2,}\b/g) || [];
  return [...new Set(matches.map((id) => Number(id)).filter((id) => Number.isInteger(id) && id > 1))];
}

function findPidsOnWindows(port) {
  const output = safeExec(`cmd /c netstat -ano -p tcp | findstr :${port}`);
  const lines = output.split(/\r?\n/).filter(Boolean);
  const pids = [];
  for (const line of lines) {
    const cols = line.trim().split(/\s+/);
    const pid = Number(cols[cols.length - 1]);
    if (Number.isInteger(pid) && pid > 1) pids.push(pid);
  }
  return [...new Set(pids)];
}

function findPidsOnUnix(port) {
  const output = safeExec(`sh -lc "lsof -ti tcp:${port} 2>/dev/null || fuser ${port}/tcp 2>/dev/null || true"`);
  return parsePids(output);
}

function killPid(pid) {
  if (pid === process.pid) return false;
  try {
    if (os.platform() === "win32") {
      execSync(`taskkill /F /PID ${pid}`, { stdio: "ignore" });
    } else {
      process.kill(pid, "SIGKILL");
    }
    return true;
  } catch (_) {
    return false;
  }
}

function freePort(port) {
  const pids = os.platform() === "win32" ? findPidsOnWindows(port) : findPidsOnUnix(port);
  if (pids.length === 0) {
    console.log(`[free-ports] 端口 ${port} 空闲`);
    return;
  }

  let killed = 0;
  for (const pid of pids) {
    if (killPid(pid)) killed += 1;
  }

  console.log(`[free-ports] 端口 ${port} 检测到 ${pids.length} 个进程，已结束 ${killed} 个`);
}

const ports = process.argv.slice(2).map((arg) => Number(arg)).filter((n) => Number.isInteger(n) && n > 0);
if (ports.length === 0) {
  console.log("[free-ports] 未传入端口，跳过");
  process.exit(0);
}

for (const port of ports) {
  freePort(port);
}
