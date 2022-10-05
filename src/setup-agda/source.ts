import * as core from '@actions/core'
import * as config from '../util/config'
import * as path from 'path'
import {cabal, getCabalVersion} from '../setup-haskell'
import {execOutput} from '../util/exec'

export async function buildAgda(version?: string): Promise<void> {
  const packageName = version === undefined ? 'Agda' : `Agda-${version}`

  // Check if Cabal is available:
  const cabalVersion = await getCabalVersion()
  core.info(`Found Cabal version ${cabalVersion}`)

  // Get the Agda source from Hackage:
  //
  // TODO: fallback to GitHub using the tags in versions?
  //
  core.info(`Get ${packageName} from Hackage`)
  await cabal(['get', packageName, '--destdir', config.cacheDir])
  const sourceDir = path.join(config.cacheDir, packageName)
  const output = await execOutput('ls', ['-R', sourceDir])
  core.info(output)
}