/**
 * Runs a command with a JDK >= 21 on PATH (firebase-tools refuses older JDKs
 * for the emulators). If the default `java` is new enough it is used as-is;
 * otherwise common JDK install folders are searched.
 *
 *   node scripts/withJava.mjs firebase emulators:start
 */
import { spawnSync } from 'node:child_process';
import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const MIN_MAJOR = 21;
const isWin = process.platform === 'win32';
const home = process.env.USERPROFILE ?? process.env.HOME ?? '';

function javaMajor(javaBin) {
  try {
    // `java -version` prints to stderr, so read both streams.
    const result = spawnSync(javaBin, ['-version'], { encoding: 'utf8' });
    const out = `${result.stdout ?? ''}${result.stderr ?? ''}`;
    const match = /version "(\d+)/.exec(out);
    return match ? Number(match[1]) : 0;
  } catch {
    return 0;
  }
}

function candidateJdkDirs() {
  const roots = [
    join(home, 'AppData', 'Local', 'Programs', 'Eclipse Adoptium'),
    'C:\\Program Files\\Eclipse Adoptium',
    'C:\\Program Files\\Java',
    'C:\\Program Files\\Microsoft',
    '/usr/lib/jvm',
    '/Library/Java/JavaVirtualMachines',
  ];
  const dirs = [];
  for (const root of roots) {
    if (!existsSync(root)) continue;
    for (const name of readdirSync(root)) {
      const major = Number(/(\d+)/.exec(name)?.[1] ?? 0);
      if (major >= MIN_MAJOR) dirs.push({ major, dir: join(root, name) });
    }
  }
  return dirs.sort((a, b) => b.major - a.major);
}

function findJavaBin() {
  if (process.env.JAVA_HOME && javaMajor(join(process.env.JAVA_HOME, 'bin', 'java')) >= MIN_MAJOR) {
    return join(process.env.JAVA_HOME, 'bin');
  }
  if (javaMajor('java') >= MIN_MAJOR) return null; // default is fine
  for (const { dir } of candidateJdkDirs()) {
    for (const bin of [join(dir, 'bin'), join(dir, 'Contents', 'Home', 'bin')]) {
      if (javaMajor(join(bin, 'java')) >= MIN_MAJOR) return bin;
    }
  }
  return undefined;
}

const [, , cmd, ...args] = process.argv;
if (!cmd) {
  console.error('Usage: node scripts/withJava.mjs <command> [args...]');
  process.exit(1);
}

const bin = findJavaBin();
if (bin === undefined) {
  console.error(`No JDK ${MIN_MAJOR}+ found. Install one from https://adoptium.net and retry.`);
  process.exit(1);
}

const env = { ...process.env };
if (bin) {
  env.JAVA_HOME = join(bin, '..');
  env.PATH = `${bin}${isWin ? ';' : ':'}${env.PATH ?? ''}`;
  console.log(`Using JDK at ${bin}`);
}

// Run through a shell so `firebase` resolves to node_modules/.bin on every OS,
// re-quoting arguments that contain spaces (the emulators:exec script, for one).
const quote = (value) => (/\s/.test(value) ? `"${value.replace(/"/g, '\\"')}"` : value);
const commandLine = [cmd, ...args].map(quote).join(' ');
const result = spawnSync(commandLine, { stdio: 'inherit', env, shell: true });
process.exit(result.status ?? 1);
