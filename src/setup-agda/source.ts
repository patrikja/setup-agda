import * as core from '@actions/core'
import * as glob from '@actions/glob'
import * as config from '../util/config'
import * as path from 'path'
import * as os from 'os'
import * as semver from 'semver'
import {
  cabal,
  getCabalVersion,
  getGHCVersionsTestedWith,
  setupHaskell
} from '../setup-haskell'

export async function buildAgda(
  agdaVersion: string,
  ghcVersionRange?: string
): Promise<void> {
  // Check if Cabal is available:
  const cabalVersion = await getCabalVersion()
  core.info(`Found Cabal version ${cabalVersion}`)

  // Update the Cabal package list:
  core.info(`Update the Cabal package list`)
  await cabal(['update'])

  // Get the Agda source from Hackage:
  //
  // TODO: fallback to GitHub using the tags in versions?
  //
  core.info(`Get Agda ${agdaVersion} from Hackage`)
  const sourceDir = await getAgdaSource(agdaVersion)
  const agdaCabalFile = path.join(sourceDir, 'Agda.cabal')

  // Select compatible GHC versions:
  const ghcVersion = await selectGHCVersion(
    agdaVersion,
    agdaCabalFile,
    ghcVersionRange
  )
  core.info(`Selected GHC version ${ghcVersion}`)

  // Setup GHC via haskell/actions/setup
  await setupHaskell({'ghc-version': ghcVersion})
}

async function selectGHCVersion(
  agdaVersion: string,
  agdaCabalFile: string,
  ghcVersionRange?: string
): Promise<string> {
  const compatibleGHCVersions = getGHCVersionsTestedWith(agdaCabalFile)
  core.info(
    [
      `Agda version ${agdaVersion} is compatible with GHC versions:`,
      compatibleGHCVersions.map(ghcVersion => ghcVersion.version).join(', ')
    ].join(os.EOL)
  )
  ghcVersionRange = ghcVersionRange ?? '*'
  const ghcVersion = semver.maxSatisfying(
    compatibleGHCVersions,
    ghcVersionRange
  )
  if (ghcVersion === null) {
    throw Error(`Could not find compatible GHC version`)
  } else {
    return ghcVersion.version
  }
}

async function getAgdaSource(version: string): Promise<string> {
  const packageName = version === 'latest' ? 'Agda' : `Agda-${version}`
  await cabal(['get', packageName, '--destdir', config.cacheDir])
  const agdaCabalGlobber = await glob.create(
    path.join(config.cacheDir, 'Agda-*', 'Agda.cabal')
  )
  const agdaCabalFiles = await agdaCabalGlobber.glob()
  if (agdaCabalFiles.length !== 1) {
    throw Error(
      agdaCabalFiles.length === 0
        ? 'Could not find Agda source distribution'
        : ['Found multiple Agda source distributions:', agdaCabalFiles].join(
            os.EOL
          )
    )
  }
  const [agdaCabalFile] = agdaCabalFiles
  return path.dirname(agdaCabalFile)
}
