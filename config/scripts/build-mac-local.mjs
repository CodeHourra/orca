import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

export function createLocalBuildVersion(baseVersion, timestamp, commit) {
  if (!/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/.test(baseVersion)) {
    throw new Error(`Package version is not valid semver: ${baseVersion}`)
  }
  if (!Number.isSafeInteger(timestamp) || timestamp <= 0) {
    throw new Error('Local build timestamp is invalid.')
  }
  const sanitizedCommit = commit.replace(/[^0-9A-Za-z-]/g, '').slice(0, 12)
  if (!sanitizedCommit) {
    throw new Error('Git commit identity is empty.')
  }
  const suffix = `local.${timestamp}.${sanitizedCommit}`
  return baseVersion.includes('-') ? `${baseVersion}.${suffix}` : `${baseVersion}-${suffix}`
}

export function getLocalBuildIdentity() {
  const packageJson = JSON.parse(readFileSync(resolve('package.json'), 'utf8'))
  const commit = execFileSync('git', ['rev-parse', '--short=12', 'HEAD'], {
    encoding: 'utf8'
  }).trim()
  return {
    commit,
    version: createLocalBuildVersion(packageJson.version, Date.now(), commit)
  }
}

// Why: local verification only needs the host-arch DMG. Dual-arch + zip roughly
// doubles electron-builder time (native rebuild + sign + package per slice).
export function getLocalMacElectronBuilderArgs(options = {}) {
  const full = options.full === true
  if (full) {
    return ['exec', 'electron-builder', '--config', 'config/electron-builder.config.cjs', '--mac']
  }
  const arch = options.arch ?? process.arch
  const archFlag = arch === 'arm64' ? '--arm64' : arch === 'x64' ? '--x64' : null
  if (!archFlag) {
    throw new Error(`Unsupported local mac build architecture: ${arch}`)
  }
  return [
    'exec',
    'electron-builder',
    '--config',
    'config/electron-builder.config.cjs',
    '--mac',
    'dmg',
    archFlag
  ]
}

if (process.argv[1] && resolve(process.argv[1]) === resolve(import.meta.filename)) {
  const identity = getLocalBuildIdentity()
  const full = process.env.ORCA_LOCAL_MAC_FULL === '1'
  // Why: Development-cert deep sign of AgentIDE.app often stalls local verification for minutes.
  const skipSign = process.env.ORCA_LOCAL_MAC_SKIP_SIGN === '1'
  const builderArgs = getLocalMacElectronBuilderArgs({
    full,
    ...(process.env.ORCA_LOCAL_MAC_ARCH
      ? { arch: process.env.ORCA_LOCAL_MAC_ARCH }
      : {})
  })
  const scope = full
    ? 'dmg+zip x64+arm64'
    : `dmg ${process.env.ORCA_LOCAL_MAC_ARCH ?? process.arch}`
  const signLabel = skipSign ? 'unsigned' : 'signed'
  console.log(
    `[build:mac] local update version ${identity.version} (productName=AgentIDE, ${scope}, ${signLabel})`
  )
  execFileSync(process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm', builderArgs, {
    env: {
      ...process.env,
      ORCA_BUILD_COMMIT: identity.commit,
      ORCA_LOCAL_BUILD_VERSION: identity.version,
      ...(skipSign
        ? {
            CSC_IDENTITY_AUTO_DISCOVERY: 'false',
            // Why: force ad-hoc for outer app + afterPack helpers (they read CSC_NAME).
            CSC_NAME: '-'
          }
        : {})
    },
    stdio: 'inherit'
  })
}
