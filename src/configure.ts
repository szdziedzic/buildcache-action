/* eslint-disable no-console */

import * as github from '@actions/github'
import * as path from 'path'
import * as toolcache from '@actions/tool-cache'

import { getInstallDir, printConfig, printStats, zeroStats } from './lib'
import { mkdirp } from 'fs-extra'
import nullthrows from 'nullthrows'
import spawnAsync from '@expo/spawn-async'

// Downloads the latest buildcache release for this OS
// accessToken is a valid github token to access APIs
// returns path to the downloaded file
export async function downloadLatest(): Promise<string> {
  // Determine correct file name
  let filename = 'buildcache-macos.zip' // our default
  switch (process.platform) {
    case 'win32':
      filename = 'buildcache-windows.zip'
      break
    case 'linux':
      filename = 'buildcache-linux.tar.gz'
      break
  }
  console.log(`buildcache: release file based on runner os is ${filename}`)

  // Grab the releases page for the for the buildcache project
  const octokit = github.getOctokit(nullthrows(process.env.GITHUB_TOKEN))

  // Should we get the latest, or has the user provided a tag?
  const buildcacheTag = process.env.BUILDCACHE_TAG
  let releaseInfo
  if (!buildcacheTag || buildcacheTag.toLowerCase() === 'latest') {
    releaseInfo = await octokit.rest.repos.getLatestRelease({
      owner: 'mbitsnbites',
      repo: 'buildcache'
    })
  } else {
    releaseInfo = await octokit.rest.repos.getReleaseByTag({
      owner: 'mbitsnbites',
      repo: 'buildcache',
      tag: buildcacheTag
    })
    if (!releaseInfo) {
      throw new Error(
        `Unable to find a buildcache release with tag '${buildcacheTag}'`
      )
    }
  }

  // core.info(`Got release info: ${JSON.stringify(releaseInfo, null, 2)}`)
  const buildCacheReleaseUrl = `https://github.com/mbitsnbites/buildcache/releases/download/${releaseInfo.data.tag_name}/${filename}`

  if (!buildCacheReleaseUrl) {
    throw new Error('Unable to determine release URL for buildcache')
  }
  console.log(`buildcache: installing from ${buildCacheReleaseUrl}`)
  const buildcacheReleasePath = await toolcache.downloadTool(
    buildCacheReleaseUrl
  )
  console.log(`buildcache: download path ${buildcacheReleasePath}`)
  return buildcacheReleasePath
}

export async function install(sourcePath: string): Promise<void> {
  console.log('installing buildcache...')
  const destPath = await getInstallDir()
  await mkdirp(destPath)

  let buildcacheFolder
  switch (process.platform) {
    case 'linux':
      buildcacheFolder = await toolcache.extractTar(sourcePath, destPath)
      break
    case 'win32':
    case 'darwin':
    default:
      buildcacheFolder = await toolcache.extractZip(sourcePath, destPath)
      break
  }

  const buildcacheBinFolder = path.resolve(
    buildcacheFolder,
    'buildcache',
    'bin'
  )
  const buildcacheBinPath = path.join(buildcacheBinFolder, 'buildcache')
  if (process.platform !== 'win32') {
    await spawnAsync('ln', [
      '-s',
      buildcacheBinPath,
      path.join(buildcacheBinFolder, 'clang')
    ])
    await spawnAsync('ln', [
      '-s',
      buildcacheBinPath,
      path.join(buildcacheBinFolder, 'clang++')
    ])
  }
  console.log(`buildcache: installed to ${buildcacheBinPath}`)
}

async function run(): Promise<void> {
  try {
    const downloadPath = await downloadLatest()
    await install(downloadPath)
    await printConfig()
    await printStats()
    const zeroStatsFlag = process.env.BUILDCACHE_ZERO_STATS
    if (zeroStatsFlag && zeroStatsFlag === 'true') {
      console.log(
        'buildcache: zeroing stats - stats display in cleanup task will be for this run only.'
      )
      await zeroStats()
    }
  } catch (e) {
    console.error(`buildcache: failure during restore: ${e}`)
    throw e
  }
}

run()

export default run
