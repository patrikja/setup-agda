import * as core from '@actions/core'
import * as glob from '@actions/glob'
import assert from 'node:assert'
import * as path from 'node:path'
import * as opts from './opts'
import * as agda from './util/agda'
import * as exec from './util/exec'
import * as hackage from './util/hackage'

// System utilities

export const brew = async (...args: string[]): Promise<string> =>
  await exec.getoutput('brew', args)

export const brewGetVersion = async (
  formula: string
): Promise<string | undefined> => {
  const formulaVersionRegExp = new RegExp(`${formula} (?<version>[\\d._]+)`)
  const formulaVersions = await brew('list', '--formula', '--versions')
  return formulaVersions.match(formulaVersionRegExp)?.groups?.version
}

export const chmod = async (...args: string[]): Promise<string> =>
  await exec.getoutput('chmod', args)

export const dumpbin = async (...args: string[]): Promise<string> =>
  await exec.getoutput('dumpbin', args)

export const installNameTool = async (...args: string[]): Promise<string> =>
  await exec.getoutput('install_name_tool', args)

export const otool = async (...args: string[]): Promise<string> =>
  await exec.getoutput('otool', args)

export const pacman = async (...args: string[]): Promise<string> =>
  await exec.getoutput('pacman', args)

export const pacmanGetVersion = async (
  pkg: string
): Promise<string | undefined> => {
  const pkgInfo = await pacman('--noconfirm', '-Qs', pkg)
  const pkgVersionRegExp = /(?<version>\d[\d.]+\d)/
  const pkgVersion = pkgInfo.match(pkgVersionRegExp)?.groups?.version
  if (pkgVersion !== undefined) return pkgVersion
  else throw Error(`Could not determine version of ${pkg}`)
}

export const patchelf = async (...args: string[]): Promise<string> =>
  await exec.getoutput('patchelf', args)

export const pkgConfig = async (...args: string[]): Promise<string> =>
  await exec.getoutput('pkg-config', args)

export const xattr = async (...args: string[]): Promise<string> =>
  await exec.getoutput('xattr', args)

// Agda utilities

export async function resolveAgdaVersion(
  options: opts.BuildOptions
): Promise<opts.BuildOptions> {
  // Ensure that we cache the package info:
  options = await cachePackageInfo(options)

  // Resolve the given version against Hackage's package versions:
  const agdaVersion = await hackage.resolvePackageVersion(
    'Agda',
    options['agda-version'],
    packageInfoOptions(options)
  )
  if (options['agda-version'] !== agdaVersion) {
    core.info(
      `Resolved Agda version ${options['agda-version']} to ${agdaVersion}`
    )
    return {...options, 'agda-version': agdaVersion}
  } else {
    return options
  }
}

export async function getAgdaSource(
  options: opts.BuildOptions
): Promise<string> {
  // Version number should be resolved by now:
  assert(
    options['agda-version'] !== 'latest' &&
      options['agda-version'] !== 'nightly',
    `getAgdaSource: agdaVersion should be resolved`
  )

  // Ensure that we cache the package info:
  options = await cachePackageInfo(options)

  // Get the package source:
  const {packageVersion, packageDir} = await hackage.getPackageSource('Agda', {
    packageVersion: options['agda-version'],
    ...packageInfoOptions(options)
  })
  assert(
    options['agda-version'] === packageVersion,
    `getAgdaSource: ${options['agda-version']} was resolved to ${packageVersion}`
  )
  return packageDir
}

export async function setupAgdaEnv(installDir: string): Promise<void> {
  const dataDir = path.join(installDir, 'data')
  core.info(`Set Agda_datadir to ${dataDir}`)
  core.exportVariable('Agda_datadir', dataDir)
  core.setOutput('agda-data-path', dataDir)
  const binDir = path.join(installDir, 'bin')
  core.info(`Add ${binDir} to PATH`)
  core.addPath(binDir)
  core.setOutput('agda-path', binDir)
  core.setOutput('agda-exe', path.join(binDir, agda.agdaBinName))
  core.setOutput('agda-mode-exe', path.join(binDir, agda.agdaModeBinName))
}

export {
  agdaBinName,
  agdaBinNames,
  agdaModeBinName,
  AgdaOptions
} from './util/agda'

export async function testAgda(
  agdaOptions?: Partial<agda.AgdaOptions>,
  options?: exec.ExecOptions
): Promise<void> {
  const versionString = await agda.getSystemAgdaVersion(agdaOptions)
  core.info(`Found Agda version ${versionString} on PATH`)
  const dataDir = await agda.getSystemAgdaDataDir(agdaOptions)
  core.info(`Found Agda data directory at ${dataDir}`)
  const globber = await glob.create(
    path.join(dataDir, 'lib', 'prim', '**', '*.agda'),
    {
      followSymbolicLinks: false,
      implicitDescendants: false,
      matchDirectories: false
    }
  )
  for await (const agdaFile of globber.globGenerator()) {
    core.info(`Compiling ${agdaFile}`)
    await agda.execSystemAgda(['-v0', agdaFile], agdaOptions, {
      ...options,
      cwd: path.join(dataDir, 'lib', 'prim')
    })
  }
}

// Helpers for caching package info

function packageInfoOptions(
  options: opts.BuildOptions
): opts.PackageInfoOptions {
  if (options['package-info-cache'] !== undefined) {
    return {
      fetchPackageInfo: false,
      packageInfoCache: options['package-info-cache']
    }
  } else {
    return {
      fetchPackageInfo: true
    }
  }
}

async function cachePackageInfo(
  options: opts.BuildOptions
): Promise<opts.BuildOptions> {
  if (options['package-info-cache'] === undefined) {
    return {
      ...options,
      'package-info-cache': await hackage.getPackageInfo('Agda', {
        packageInfoCache: opts.packageInfoCache
      })
    }
  } else {
    return options
  }
}
