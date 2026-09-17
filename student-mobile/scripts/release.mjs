import { spawn } from 'node:child_process';

const rawArgs = process.argv.slice(2);
const dryRun = rawArgs.includes('--dry-run');
const args = rawArgs.filter((arg) => arg !== '--dry-run');

const [platform = 'all', bump = 'patch'] = args;

const validPlatforms = new Set(['android', 'ios', 'all']);
const validBumps = new Set(['patch', 'minor', 'major']);

if (!validPlatforms.has(platform)) {
  console.error(`Plataforma invalida: ${platform}. Use android, ios ou all.`);
  process.exit(1);
}

if (!validBumps.has(bump)) {
  console.error(`Incremento invalido: ${bump}. Use patch, minor ou major.`);
  process.exit(1);
}

const steps = [
  `npm version ${bump} --no-git-tag-version`,
  ...getBuildCommands(platform),
];

if (dryRun) {
  for (const command of steps) {
    console.log(command);
  }
  process.exit(0);
}

for (const command of steps) {
  await run(command);
}

function getBuildCommands(targetPlatform) {
  if (targetPlatform === 'android') {
    return ['npx eas-cli@latest build --platform android --profile production --non-interactive --no-wait'];
  }

  if (targetPlatform === 'ios') {
    return ['npx eas-cli@latest build --platform ios --profile production --auto-submit --non-interactive --no-wait'];
  }

  return [
    'npx eas-cli@latest build --platform android --profile production --non-interactive --no-wait',
    'npx eas-cli@latest build --platform ios --profile production --auto-submit --non-interactive --no-wait',
  ];
}

async function run(command) {
  await new Promise((resolve, reject) => {
    const child = spawn(command, {
      cwd: process.cwd(),
      stdio: 'inherit',
      env: process.env,
      shell: true,
    });

    child.on('exit', (code) => {
      if (code === 0) {
        resolve();
        return;
      }

      reject(new Error(`${command} failed with exit code ${code ?? 'unknown'}`));
    });

    child.on('error', reject);
  });
}
