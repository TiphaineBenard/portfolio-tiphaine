# ============================================================
# Téléchargement des polices Google Fonts en local
# Vanbaelinghem — Commandes Événementielles
#
# Lancer ce script UNE SEULE FOIS depuis PowerShell :
#   Right-clic sur ce fichier > "Exécuter avec PowerShell"
#
# Il télécharge Fraunces, Inter et JetBrains Mono dans
# assets/fonts/ et génère css/fonts-local.css.
# L'application utilisera ensuite ces polices hors-ligne.
# ============================================================

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$fontsDir  = Join-Path $scriptDir "assets\fonts"
$cssFile   = Join-Path $scriptDir "css\fonts-local.css"

if (-not (Test-Path $fontsDir)) { New-Item -ItemType Directory -Path $fontsDir | Out-Null }

$ua = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124.0 Safari/537.36"

function Get-GoogleFontsCss($url) {
  $resp = Invoke-WebRequest -Uri $url -UserAgent $ua -UseBasicParsing
  return $resp.Content
}

function Download-Woff2($css, $prefix) {
  $pattern = "url\((https://fonts\.gstatic\.com/[^)]+\.woff2)\)"
  $matches  = [regex]::Matches($css, $pattern)
  $localCss = $css

  foreach ($m in $matches) {
    $woff2Url  = $m.Groups[1].Value
    $fileName  = $prefix + "_" + ($woff2Url -split "/" | Select-Object -Last 1)
    $localPath = Join-Path $fontsDir $fileName
    if (-not (Test-Path $localPath)) {
      Invoke-WebRequest -Uri $woff2Url -OutFile $localPath -UseBasicParsing | Out-Null
      Write-Host "  Téléchargé : $fileName"
    } else {
      Write-Host "  Déjà présent : $fileName"
    }
    $localCss = $localCss -replace [regex]::Escape($woff2Url), "../assets/fonts/$fileName"
  }
  return $localCss
}

$allCss = ""

Write-Host "Fraunces..."
$css = Get-GoogleFontsCss "https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,500;0,9..144,600;0,9..144,700&display=swap"
$allCss += Download-Woff2 $css "fraunces"

Write-Host "Inter..."
$css = Get-GoogleFontsCss "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap"
$allCss += Download-Woff2 $css "inter"

Write-Host "JetBrains Mono..."
$css = Get-GoogleFontsCss "https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@500;700&display=swap"
$allCss += Download-Woff2 $css "jetbrains"

Set-Content -Path $cssFile -Value $allCss -Encoding UTF8
Write-Host ""
Write-Host "Terminé ! Polices disponibles hors-ligne." -ForegroundColor Green
Write-Host "Fichier généré : css/fonts-local.css" -ForegroundColor Green
pause
