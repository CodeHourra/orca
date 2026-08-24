import { describe, expect, it } from 'vitest'
import { createLocalBuildVersion, getLocalMacElectronBuilderArgs } from './build-mac-local.mjs'

describe('createLocalBuildVersion', () => {
  it('creates unique valid prerelease versions without changing the release base', () => {
    expect(createLocalBuildVersion('1.4.159-rc.0', 123456, 'abc123')).toBe(
      '1.4.159-rc.0.local.123456.abc123'
    )
    expect(createLocalBuildVersion('1.4.159', 123456, 'abc123')).toBe('1.4.159-local.123456.abc123')
  })

  it('sanitizes commit identifiers', () => {
    expect(createLocalBuildVersion('1.0.0', 1, 'abc/def')).toBe('1.0.0-local.1.abcdef')
  })
})

describe('getLocalMacElectronBuilderArgs', () => {
  it('defaults to a host-arch DMG-only package for local verification', () => {
    expect(getLocalMacElectronBuilderArgs({ arch: 'arm64' })).toEqual([
      'exec',
      'electron-builder',
      '--config',
      'config/electron-builder.config.cjs',
      '--mac',
      'dmg',
      '--arm64'
    ])
    expect(getLocalMacElectronBuilderArgs({ arch: 'x64' })).toEqual([
      'exec',
      'electron-builder',
      '--config',
      'config/electron-builder.config.cjs',
      '--mac',
      'dmg',
      '--x64'
    ])
  })

  it('keeps the dual-arch dmg+zip path behind an explicit full flag', () => {
    expect(getLocalMacElectronBuilderArgs({ full: true })).toEqual([
      'exec',
      'electron-builder',
      '--config',
      'config/electron-builder.config.cjs',
      '--mac'
    ])
  })
})
