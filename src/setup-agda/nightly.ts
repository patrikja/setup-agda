import * as core from '@actions/core'
import * as glob from '@actions/glob'
import * as io from '@actions/io'
import * as toolCache from '@actions/tool-cache'
import assert from 'assert'
import * as process from 'process'
import {agdaTest, installDir, cacheDir, Platform} from './utils'
import * as os from 'os'
import * as fs from 'fs'

const nightlyUrlLinux =
  'https://github.com/agda/agda/releases/download/nightly/Agda-nightly-linux.tar.xz'
const nightlyUrlDarwin =
  'https://github.com/agda/agda/releases/download/nightly/Agda-nightly-macOS.tar.xz'
const nightlyUrlWin32 =
  'https://github.com/agda/agda/releases/download/nightly/Agda-nightly-win64.zip'

export default async function setupAgdaNightly(): Promise<void> {
  const platform = process.platform as Platform
  core.info(`Setup 'nightly' on ${platform}`)
  switch (platform) {
    case 'linux': {
      // Download archive:
      core.info(`Download nightly build from ${nightlyUrlLinux}`)
      const agdaNightlyTar = await toolCache.downloadTool(nightlyUrlLinux)
      const {mtime} = fs.statSync(agdaNightlyTar)
      core.info(`Nighly build last modified at ${mtime.toUTCString()}`)

      // Extract archive:
      core.info(`Extract nightly build to ${installDir}`)
      io.mkdirP(installDir)
      const installDirTC = await toolCache.extractTar(
        agdaNightlyTar,
        installDir,
        ['--extract', '--xz', '--preserve-permissions', '--strip-components=1']
      )

      // Configure Agda:
      assert(
        installDir === installDirTC,
        [
          'Wrong installation directory:',
          `Expected ${installDir}`,
          `Actual ${installDirTC}`
        ].join(os.EOL)
      )
      core.exportVariable('Agda_datadir', `${installDir}/data`)
      core.addPath(`${installDir}/bin`)
      break
    }
    case 'darwin': {
      // Download archive:
      core.info(`Download nightly build from ${nightlyUrlDarwin}`)
      const agdaNightlyTar = await toolCache.downloadTool(nightlyUrlDarwin)
      const {mtime} = fs.statSync(agdaNightlyTar)
      core.info(`Nighly build last modified at ${mtime.toUTCString()}`)

      // Extract archive:
      core.info(`Extract nightly build to ${installDir}`)
      io.mkdirP(installDir)
      const installDirTC = await toolCache.extractTar(
        agdaNightlyTar,
        installDir,
        ['--extract', '--xz', '--preserve-permissions', '--strip-components=1']
      )

      // Configure Agda:
      assert(
        installDir === installDirTC,
        [
          'Wrong installation directory:',
          `Expected ${installDir}`,
          `Actual ${installDirTC}`
        ].join(os.EOL)
      )
      core.exportVariable('Agda_datadir', `${installDir}/data`)
      core.addPath(`${installDir}/bin`)
      break
    }
    case 'win32': {
      // Download archive:
      core.info(`Download nightly build from ${nightlyUrlWin32}`)
      const agdaNightlyZip = await toolCache.downloadTool(nightlyUrlWin32)
      const {mtime} = fs.statSync(agdaNightlyZip)
      core.info(`Nighly build last modified at ${mtime.toUTCString()}`)

      // Extract archive:
      core.info(`Extract nightly build to ${cacheDir}`)
      io.mkdirP(cacheDir)
      const cacheDirTC = await toolCache.extractZip(agdaNightlyZip, cacheDir)

      // Copy extracted files to installDir:
      core.info(`Copy nightly build to ${installDir}`)
      io.mkdirP(installDir)
      const globber = await glob.create(
        core.toPlatformPath(`${cacheDirTC}/Agda-nightly/*`),
        {matchDirectories: true}
      )
      for await (const file of globber.globGenerator()) {
        core.info(`Install ${file} to ${installDir}`)
        io.cp(file, installDir, {recursive: true})
      }

      // Clean up cacheDir
      io.rmRF(`${cacheDirTC}/Agda-nightly`)
      break
    }
  }
  // Configure Agda:
  core.exportVariable('Agda_datadir', core.toPlatformPath(`${installDir}/data`))
  core.addPath(core.toPlatformPath(`${installDir}/bin`))

  // Test Agda installation:
  await agdaTest()
}
