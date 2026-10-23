param(
    [string]$SkillsRoot,
    [string]$VaultRoot,
    [string]$Service
)
$ErrorActionPreference = 'Stop'
$installArguments = @((Join-Path $PSScriptRoot 'install.py'))
if ($VaultRoot) { $installArguments += @('--vault-root', $VaultRoot) }
if ($Service) { $installArguments += @('--service', $Service) }
if ($SkillsRoot) { $installArguments += @('--skills-root', $SkillsRoot) }
python @installArguments
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
