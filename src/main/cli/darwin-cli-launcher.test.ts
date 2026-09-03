import { copyFile, mkdir, mkdtemp, realpath, rm, symlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { expect, it } from 'vitest'
import { runProcess } from '../../shared/child-process/run-process'

it.skipIf(process.platform !== 'darwin').each(['Orca', 'AgentIDE'])(
  'launches the declared %s executable through the installed CLI symlink',
  async (executableName) => {
    const root = await realpath(await mkdtemp(join(tmpdir(), 'orca cli macos-')))
    const contents = join(root, 'Renamed Bundle.app', 'Contents')
    const launcher = join(contents, 'Resources', 'bin', 'orca')
    const executable = join(contents, 'MacOS', executableName)
    const cli = join(contents, 'Resources', 'app.asar.unpacked', 'out', 'cli', 'index.js')
    const command = join(root, 'orca')
    try {
      await mkdir(dirname(launcher), { recursive: true })
      await mkdir(dirname(executable), { recursive: true })
      await mkdir(dirname(cli), { recursive: true })
      await copyFile(new URL('../../../resources/darwin/bin/orca', import.meta.url), launcher)
      await writeFile(
        join(contents, 'Info.plist'),
        `<plist version="1.0"><dict><key>CFBundleExecutable</key><string>${executableName}</string></dict></plist>`
      )
      await writeFile(cli, '')
      await writeFile(
        executable,
        '#!/bin/bash\nprintf "%s\\n" "$0" "$ELECTRON_RUN_AS_NODE" "$@"\n',
        { mode: 0o755 }
      )
      await symlink(launcher, command)

      const result = await runProcess({
        program: command,
        args: ['skills', 'get', 'two words'],
        timeoutMs: 3_000
      })

      expect(result.stderr).toBe('')
      expect(result.code).toBe(0)
      expect(result.stdout.trim().split('\n')).toEqual([
        executable,
        '1',
        cli,
        'skills',
        'get',
        'two words'
      ])
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  }
)
