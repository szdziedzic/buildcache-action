import { mkdirp } from 'fs-extra'
import nullthrows from 'nullthrows'
import path from 'path'
import spawnAsync from '@expo/spawn-async'

export interface Stats {
  entries: number
  misses: number
}

async function execBuildCacheWithoutImpersonation(
  arg: string,
  options?: {}
): Promise<void> {
  const env = { ...process.env }
  if (env.BUILDCACHE_IMPERSONATE) {
    delete env.BUILDCACHE_IMPERSONATE
  }
  await spawnAsync(
    '/Users/expo/workingdir/build/managed/buildcache/buildcache/bin/buildcache',
    [arg],
    { ...options, env }
  )
}

export async function printConfig(): Promise<void> {
  await execBuildCacheWithoutImpersonation('-c')
}

export async function printStats(): Promise<Stats> {
  let output = ''
  await execBuildCacheWithoutImpersonation('-s', {
    listeners: {
      stdout: (data: Buffer) => {
        output += data.toString()
      }
    }
  })

  const get = (name: string, def: string): string => {
    return output.match(RegExp(`^  ${name}:\\s*(\\d+)$`, 'm'))?.[1] || def
  }

  return {
    entries: parseInt(get(`Entries in cache`, '-1')),
    misses: parseInt(get(`Misses`, '-1'))
  }
}

export async function zeroStats(): Promise<void> {
  await execBuildCacheWithoutImpersonation('-z')
}

export async function getInstallDir(): Promise<string> {
  const installDir = nullthrows(process.env.BUILDCACHE_INSTALL_DIR)
  await mkdirp(installDir)
  return installDir
}

export async function getCacheDir(): Promise<string> {
  return path.resolve(
    await getInstallDir(),
    nullthrows(process.env.BUILDCACHE_DIR)
  )
}

export function getCacheKeys(): {
  base: string
  withInput: string
  unique: string
} {
  const base = 'buildcache'

  const inputKey = nullthrows(process.env.CACHE_KEY)
  let withInput = base
  if (inputKey) {
    withInput = `${base}-${inputKey}`
  }

  const unique = `${withInput}-${new Date().toISOString()}`

  return {
    base,
    withInput,
    unique
  }
}
