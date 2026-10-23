param(
    [string]$SkillsRoot,
    [string]$VaultRoot = (Join-Path ([Environment]::GetFolderPath('UserProfile')) 'Downloads\Design Shelf')
)
$ErrorActionPreference = 'Stop'
$installArguments = @((Join-Path $PSScriptRoot 'install.py'), '--vault-root', $VaultRoot)
if ($SkillsRoot) { $installArguments += @('--skills-root', $SkillsRoot) }
python @installArguments
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
