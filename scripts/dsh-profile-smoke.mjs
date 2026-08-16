import { access, chmod, mkdir, mkdtemp, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { spawn, spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dshBin = process.env.DSH_BIN ?? path.join(root, 'node_modules', '@deepseek-ai', 'dsh', 'lib', 'bin.js');
const pnpmCommand = ['corepack', 'pnpm'];

const run = (command, args, options = {}) => {
  const result = spawnSync(command, args, {
    cwd: options.cwd ?? root,
    env: options.env ?? process.env,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    shell: options.shell ?? false,
    windowsHide: true,
  });
  const output = `${result.stdout ?? ''}${result.stderr ?? ''}`;
  if (result.error !== undefined) {
    throw new Error(`${command} ${args.join(' ')} failed to start: ${result.error.message}\n${output}`);
  }
  if (result.status !== 0) {
    throw new Error(`${command} ${args.join(' ')} exited with ${String(result.status)}\n${output}`);
  }
  return output;
};

const runPnpm = (args, options = {}) => {
  if (process.platform !== 'win32') return run('corepack', ['pnpm', ...args], options);
  const commandLine = [...pnpmCommand, ...args]
    .map((argument) => {
      const value = String(argument);
      return /[\s&()<>|]/.test(value) ? `"${value.replaceAll('"', '\\"')}"` : value;
    })
    .join(' ');
  return run(process.env.ComSpec ?? 'cmd.exe', ['/d', '/s', '/c', commandLine], options);
};

const runDsh = (args, env) => run(process.execPath, [dshBin, ...args], { cwd: root, env });

const createPnpmShim = async (tempRoot) => {
  const shimDir = path.join(tempRoot, 'bin');
  await mkdir(shimDir, { recursive: true });
  if (process.platform === 'win32') {
    await writeFile(path.join(shimDir, 'pnpm.cmd'), '@echo off\r\ncorepack pnpm %*\r\n', 'utf8');
  } else {
    const shimPath = path.join(shimDir, 'pnpm');
    await writeFile(shimPath, '#!/bin/sh\nexec corepack pnpm "$@"\n', 'utf8');
    await chmod(shimPath, 0o755);
  }
  return shimDir;
};

const killProcessTree = (child) => {
  if (child.exitCode !== null || child.killed) return;
  if (process.platform === 'win32' && child.pid !== undefined) {
    spawnSync('taskkill.exe', ['/pid', String(child.pid), '/t', '/f'], {
      stdio: 'ignore',
      windowsHide: true,
    });
    return;
  }
  child.kill('SIGTERM');
};

const waitForWebServer = (env) => new Promise((resolve, reject) => {
  const child = spawn(process.execPath, [dshBin, '--profile', 'web', '--port', '0'], {
    cwd: root,
    env,
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true,
  });
  let output = '';
  let settled = false;
  const timeout = setTimeout(() => {
    if (settled) return;
    settled = true;
    killProcessTree(child);
    reject(new Error(`DSH web profile did not announce a loopback server within 20 seconds\n${output}`));
  }, 20_000);

  const onData = (chunk) => {
    output += chunk.toString();
    const match = output.match(/dsh web:\s+http:\/\/127\.0\.0\.1:\d+/);
    if (!settled && match !== null) {
      settled = true;
      clearTimeout(timeout);
      killProcessTree(child);
      resolve(output);
    }
  };

  child.stdout.on('data', onData);
  child.stderr.on('data', onData);
  child.once('error', (error) => {
    if (settled) return;
    settled = true;
    clearTimeout(timeout);
    reject(new Error(`DSH web profile failed to start: ${error.message}\n${output}`));
  });
  child.once('exit', (code, signal) => {
    if (settled) return;
    settled = true;
    clearTimeout(timeout);
    reject(new Error(`DSH web profile exited before listening (code=${String(code)}, signal=${String(signal)})\n${output}`));
  });
});

const main = async () => {
  await access(path.join(root, 'dist', 'src', 'index.js'));
  await access(dshBin);

  const tempRoot = await mkdtemp(path.join(tmpdir(), 'dsh-job-hunting-smoke-'));
  const packDir = path.join(tempRoot, 'pack');
  const dshHome = path.join(tempRoot, 'home');

  try {
    const shimDir = await createPnpmShim(tempRoot);
    const env = {
      ...process.env,
      DSH_HOME: dshHome,
      PATH: [shimDir, process.env.PATH].filter(Boolean).join(path.delimiter),
    };
    await mkdir(packDir, { recursive: true });
    runPnpm(['pack', '--pack-destination', packDir], { cwd: root, env });
    const tarballs = (await readdir(packDir)).filter((entry) => entry.endsWith('.tgz'));
    if (tarballs.length !== 1) {
      throw new Error(`Expected exactly one packed plugin tarball, found ${String(tarballs.length)}`);
    }

    const tarball = path.join(packDir, tarballs[0]);
    runDsh(['plugin', '--profile', 'web', 'add', tarball], env);

    const profileManifestPath = path.join(dshHome, 'profiles', 'web', 'package.json');
    const profileManifest = JSON.parse(await readFile(profileManifestPath, 'utf8'));
    if (profileManifest.dependencies?.['dsh-job-hunting'] === undefined) {
      throw new Error('The isolated web profile did not record dsh-job-hunting as a dependency');
    }
    if (!profileManifest.dsh?.profile?.bundles?.includes('dsh-job-hunting')) {
      throw new Error('The DSH plugin reconciler did not add dsh-job-hunting to profile bundles');
    }

    const dump = runDsh(['--profile', 'web', '--dump-config'], env);
    if (!dump.includes('job-hunting') || !dump.includes('dsh-job-hunting')) {
      throw new Error(`The composed DSH profile does not contain the Job Hunting bundle\n${dump}`);
    }

    await waitForWebServer(env);
    console.log('DSH profile smoke passed: tarball install, bundle reconciliation, config dump, and web boot.');
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
};

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
