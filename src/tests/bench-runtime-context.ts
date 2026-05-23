/**
 * 基准测试：对比 Sync 串行 vs Async 并行
 *
 * 用法：npx tsx src/tests/bench-runtime-context.ts
 */

import { execSync, execFileSync, exec, execFile } from "child_process";
import { promisify } from "util";
import * as os from "os";
import { findGitBashPath, resolveShellPath } from "../common/shell-utils";

const execFileAsync = promisify(execFile) as (...args: unknown[]) => Promise<{ stdout: string; stderr: string }>;
const execAsync = promisify(exec) as (...args: unknown[]) => Promise<{ stdout: string; stderr: string }>;

function shellSingleQuote(value: string): string {
  return `'${value.replace(/'/g, "'\"'\"'")}'`;
}

// ─── 探测任务 ────────────────────────────────────────────────

const PROBES: { label: string; needsBash: boolean; isCheck: boolean }[] = [
  { label: "uname -a", needsBash: true, isCheck: false },
  { label: "resolve shell path", needsBash: false, isCheck: false },
  { label: "python3 --version", needsBash: true, isCheck: false },
  { label: "node --version", needsBash: true, isCheck: false },
  { label: "check rg", needsBash: true, isCheck: true },
  { label: "check jq", needsBash: true, isCheck: true },
];

// ─── 数据结构 ────────────────────────────────────────────────

interface TimedStep {
  label: string;
  startMs: number;
  elapsedMs: number;
  endMs: number;
  stdout: string;
}
interface StrategyResult {
  totalMs: number;
  steps: TimedStep[];
}

// ─── 执行原语 ────────────────────────────────────────────────

function execCommand(label: string, ic: boolean): string {
  if (process.platform === "win32") {
    const bp = findGitBashPath();
    if (ic) {
      execFileSync(bp, ["-lc", `command -v ${shellSingleQuote(label.replace("check ", ""))}`], {
        encoding: "utf8",
        stdio: "ignore",
        windowsHide: true,
      });
      return "";
    }
    if (label === "uname -a")
      return execFileSync(bp, ["-lc", "uname -a"], { encoding: "utf8", windowsHide: true }).trim();
    return execFileSync(bp, ["-lc", `${label} 2>&1`], { encoding: "utf8", windowsHide: true }).trim();
  }
  if (ic) {
    execSync(`command -v ${label.replace("check ", "")}`, { encoding: "utf8", stdio: "ignore" });
    return "";
  }
  return execSync(`${label} 2>&1`, { encoding: "utf8" }).trim();
}

async function execCommandAsync(label: string, ic: boolean): Promise<string> {
  if (process.platform === "win32") {
    const bp = findGitBashPath();
    if (ic) {
      await execFileAsync(bp, ["-lc", `command -v ${shellSingleQuote(label.replace("check ", ""))}`], {
        encoding: "utf8",
        stdio: "ignore",
        windowsHide: true,
      });
      return "";
    }
    if (label === "uname -a") {
      const r = await execFileAsync(bp, ["-lc", "uname -a"], { encoding: "utf8", windowsHide: true });
      return r.stdout.trim();
    }
    const r = await execFileAsync(bp, ["-lc", `${label} 2>&1`], { encoding: "utf8", windowsHide: true });
    return r.stdout.trim();
  }
  if (ic) {
    await execAsync(`command -v ${label.replace("check ", "")}`, { encoding: "utf8", stdio: "ignore" });
    return "";
  }
  const r = await execAsync(`${label} 2>&1`, { encoding: "utf8" });
  return r.stdout.trim();
}

function runSyncStep(label: string, nb: boolean, ic: boolean): { elapsedMs: number; stdout: string } {
  const t0 = performance.now();
  let stdout = "";
  try {
    if (!nb) {
      resolveShellPath();
      return { elapsedMs: performance.now() - t0, stdout: "" };
    }
    stdout = execCommand(label, ic);
  } catch {
    /* ignore */
  }
  return { elapsedMs: performance.now() - t0, stdout };
}

async function runAsyncStep(label: string, nb: boolean, ic: boolean, w0: number): Promise<TimedStep> {
  const startMs = performance.now() - w0;
  let stdout = "";
  try {
    if (!nb) {
      resolveShellPath();
      const e = performance.now() - w0;
      return { label, startMs, elapsedMs: e - startMs, endMs: e, stdout: "" };
    }
    stdout = await execCommandAsync(label, ic);
  } catch {
    /* ignore */
  }
  const e = performance.now() - w0;
  return { label, startMs, elapsedMs: e - startMs, endMs: e, stdout };
}

// ─── 策略 ────────────────────────────────────────────────────

function strategySyncSerial(): StrategyResult {
  let cum = 0;
  const steps = PROBES.map((p) => {
    const { elapsedMs, stdout } = runSyncStep(p.label, p.needsBash, p.isCheck);
    const s: TimedStep = { label: p.label, startMs: cum, elapsedMs, endMs: cum + elapsedMs, stdout };
    cum += elapsedMs;
    return s;
  });
  return { totalMs: cum, steps };
}

async function strategyAsyncParallel(): Promise<StrategyResult> {
  const w0 = performance.now();
  const bash = PROBES.filter((p) => p.needsBash);
  const sync = PROBES.find((p) => !p.needsBash)!;
  const pn = PROBES.filter((p) => p.label.startsWith("python") || p.label.startsWith("node"));
  const rest = bash.filter((p) => !pn.includes(p));

  const grp = await Promise.all([
    runAsyncStep(rest[0].label, rest[0].needsBash, rest[0].isCheck, w0),
    runAsyncStep(sync.label, sync.needsBash, sync.isCheck, w0),
    (async () => Promise.all(pn.map((p) => runAsyncStep(p.label, p.needsBash, p.isCheck, w0))))(),
    ...rest.slice(1).map((p) => runAsyncStep(p.label, p.needsBash, p.isCheck, w0)),
  ]);
  const totalMs = performance.now() - w0;
  return { totalMs, steps: grp.flat().sort((a, b) => a.startMs - b.startMs) };
}

// ─── 输出：时间线柱状图 ─────────────────────────────────────

function printTimeline(name: string, r: StrategyResult) {
  const W = 44;
  const t = r.totalMs;
  const ss = [...r.steps].sort((a, b) => a.startMs - b.startMs);

  console.log(`  ${name}`);
  for (const s of ss) {
    const gap = Math.round((s.startMs / t) * W);
    const dur = Math.max(Math.round((s.elapsedMs / t) * W), 1);
    const line = " ".repeat(Math.max(gap, 0)) + "█".repeat(dur);
    // stdout 只显示第一行，截断到 40 字符
    const result = s.stdout ? s.stdout.split("\n")[0].slice(0, 40) : "";
    console.log(`    ${s.label.padEnd(22)} ${line.padEnd(W + 1)} ${s.elapsedMs.toFixed(0).padStart(5)} ms  ${result}`);
  }
  console.log(
    `    ${" ".repeat(22)} 0${" ".repeat(Math.round(0.5 * W) - 2)}${(t / 1000 / 2).toFixed(1)}s${" ".repeat(Math.round(0.5 * W) - 2)}${(t / 1000).toFixed(1)}s`
  );
  console.log();
}

function printTotalComp(sync: StrategyResult, async: StrategyResult) {
  const maxT = Math.max(sync.totalMs, async.totalMs);
  const W = 52;
  console.log(`  ── 总耗时对比（max=${maxT.toFixed(0)} ms）──`);
  console.log();
  const items = [
    { label: "Sync serial", total: sync.totalMs },
    { label: "Async parallel", total: async.totalMs },
  ];
  for (const { label, total } of items) {
    const n = Math.max(Math.round((total / maxT) * W), 1);
    const star = total === Math.min(sync.totalMs, async.totalMs) ? "★" : " ";
    console.log(`  ${star} ${label.padEnd(16)} ${"█".repeat(n).padEnd(W + 1)} ${total.toFixed(0).padStart(6)} ms`);
  }
  console.log();
}

// ─── 主流程 ──────────────────────────────────────────────────

async function main() {
  const RUNS = 1;

  console.log("Runtime Context 探针 · 性能对比");
  console.log("Platform:", os.type(), os.release(), os.arch());
  console.log(`每轮测试数: ${RUNS}`);
  console.log();

  const syncRuns: number[] = [];
  const asyncRuns: number[] = [];

  for (let round = 1; round <= RUNS; round++) {
    console.log(`── 第 ${round} 轮 ──`);
    console.log();

    const s = strategySyncSerial();
    syncRuns.push(s.totalMs);
    printTimeline("[Sync 串行]", s);

    const a = await strategyAsyncParallel();
    asyncRuns.push(a.totalMs);
    printTimeline("[Async 全并行]", a);

    printTotalComp(s, a);
  }

  // ── 汇总 ──
  const avg = (arr: number[]) => arr.reduce((a, b) => a + b, 0) / arr.length;
  const syncAvg = avg(syncRuns);
  const asyncAvg = avg(asyncRuns);

  const colHeaders = Array.from({ length: RUNS }, (_, i) => `第${i + 1}轮`);
  colHeaders.push("平均");
  const colW = 12;

  console.log("── 汇总 ──");
  console.log();
  console.log(`  ${"策略".padEnd(20)} ${colHeaders.map((h) => h.padStart(colW)).join("")}`);
  console.log(`  ${"─".repeat(20)} ${colHeaders.map(() => "─".repeat(colW)).join("")}`);
  console.log(
    `  ${"Sync 串行".padEnd(20)}` +
      ` ${syncRuns.map((v) => v.toFixed(0).padStart(colW - 2) + " ms").join("")}` +
      ` ${syncAvg.toFixed(0).padStart(colW - 2)} ms`
  );
  console.log(
    `  ${"Async 并行".padEnd(20)}` +
      ` ${asyncRuns.map((v) => v.toFixed(0).padStart(colW - 2) + " ms").join("")}` +
      ` ${asyncAvg.toFixed(0).padStart(colW - 2)} ms`
  );
  console.log();

  // ── 结果 ──
  console.log("── 结果 ──");
  console.log();
  console.log(`  Async 并行比 Sync 串行平均快 ${((1 - asyncAvg / syncAvg) * 100).toFixed(0)}%`);
  console.log(`  每次 getRuntimeContext 调用节省 ${(syncAvg - asyncAvg).toFixed(0)} ms`);
  console.log(`  且 Async 版本不阻塞事件循环，终端 UI 保持响应`);
  console.log();
  console.log("  Prewarm: SessionManager 构造时触发后台 prewarmRuntimeContext()");
  console.log("  用户输入提示词期间计算已完成，createSession() 调用时零等待");
  console.log();
}

main().catch(console.error);
