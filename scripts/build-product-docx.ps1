# Build 产品说明.docx from 产品说明.md (minimal OOXML, UTF-8)
$ErrorActionPreference = "Stop"
$root = Split-Path $PSScriptRoot -Parent
# 产品说明 — build path via codepoints so the script runs under non-UTF8 consoles
$docBase = -join [char[]](0x4EA7, 0x54C1, 0x8BF4, 0x660E)
$mdPath = Join-Path $root "$docBase.md"
$outPath = Join-Path $root "$docBase.docx"
if (-not (Test-Path -LiteralPath $mdPath)) { throw "Missing: $mdPath" }

function Escape-Xml([string]$s) {
  if ($null -eq $s) { return "" }
  return ($s -replace '&', '&amp;' -replace '<', '&lt;' -replace '>', '&gt;')
}

function New-Paragraph([string]$text, [bool]$bold = $false, [int]$fontHalfPoints = 24) {
  $esc = Escape-Xml $text
  $rPr = if ($bold) { "<w:rPr><w:b/><w:sz w:val=""$fontHalfPoints""/><w:szCs w:val=""$fontHalfPoints""/></w:rPr>" } else { "<w:rPr><w:sz w:val=""$fontHalfPoints""/><w:szCs w:val=""$fontHalfPoints""/></w:rPr>" }
  return "<w:p><w:r>$rPr<w:t xml:space=""preserve"">$esc</w:t></w:r></w:p>"
}

$lines = Get-Content -LiteralPath $mdPath -Encoding UTF8
$bodyParts = [System.Collections.Generic.List[string]]::new()

foreach ($line in $lines) {
  if ($line -match '^\s*$') {
    $bodyParts.Add("<w:p/>")
    continue
  }
  if ($line -match '^---+\s*$') {
    $bodyParts.Add("<w:p/>")
    continue
  }
  if ($line -match '^\|\s*([^|]+)\s*\|\s*([^|]+)\s*\|\s*$') {
    $a = $Matches[1].Trim()
    $b = $Matches[2].Trim()
    if ($a -match '^[-:]+$' -and $b -match '^[-:]+$') { continue }
    $bodyParts.Add((New-Paragraph "$a`t$b" $false 22))
    continue
  }
  if ($line -match '^>\s*(.*)$') {
    $bodyParts.Add((New-Paragraph $Matches[1] $false 22))
    continue
  }
  if ($line -match '^#\s+(.+)$') {
    $bodyParts.Add((New-Paragraph $Matches[1] $true 36))
    continue
  }
  if ($line -match '^##\s+(.+)$') {
    $bodyParts.Add((New-Paragraph $Matches[1] $true 30))
    continue
  }
  if ($line -match '^###\s+(.+)$') {
    $bodyParts.Add((New-Paragraph $Matches[1] $true 26))
    continue
  }
  $bodyParts.Add((New-Paragraph $line $false 24))
}

$bodyXml = $bodyParts -join "`n"
$documentXml = @"
<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <w:body>
$bodyXml
    <w:sectPr>
      <w:pgSz w:w="11906" w:h="16838"/>
      <w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440" w:header="708" w:footer="708" w:gutter="0"/>
    </w:sectPr>
  </w:body>
</w:document>
"@

$contentTypes = @"
<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
  <Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>
  <Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/>
</Types>
"@

$rels = @"
<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/>
  <Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/>
</Relationships>
"@

$docRels = @"
<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"/>
"@

$now = [DateTime]::UtcNow.ToString("s") + "Z"
$coreXml = @"
<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:dcmitype="http://purl.org/dc/dcmitype/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
  <dc:title>迷宫视觉生成器 产品说明</dc:title>
  <dc:creator>Maze Visual Creator</dc:creator>
  <cp:lastModifiedBy>Maze Visual Creator</cp:lastModifiedBy>
  <dcterms:created xsi:type="dcterms:W3CDTF">$now</dcterms:created>
  <dcterms:modified xsi:type="dcterms:W3CDTF">$now</dcterms:modified>
</cp:coreProperties>
"@

$appXml = @"
<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties" xmlns:vt="http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes">
  <Application>Maze Visual Creator build script</Application>
</Properties>
"@

$workDir = Join-Path $env:TEMP ("maze_docx_" + [Guid]::NewGuid().ToString("N"))
New-Item -ItemType Directory -Path (Join-Path $workDir "_rels") -Force | Out-Null
New-Item -ItemType Directory -Path (Join-Path $workDir "word\_rels") -Force | Out-Null
New-Item -ItemType Directory -Path (Join-Path $workDir "docProps") -Force | Out-Null

[System.IO.File]::WriteAllText((Join-Path $workDir "[Content_Types].xml"), $contentTypes, [System.Text.UTF8Encoding]::new($false))
[System.IO.File]::WriteAllText((Join-Path $workDir "_rels\.rels"), $rels, [System.Text.UTF8Encoding]::new($false))
[System.IO.File]::WriteAllText((Join-Path $workDir "word\document.xml"), $documentXml, [System.Text.UTF8Encoding]::new($false))
[System.IO.File]::WriteAllText((Join-Path $workDir "word\_rels\document.xml.rels"), $docRels, [System.Text.UTF8Encoding]::new($false))
[System.IO.File]::WriteAllText((Join-Path $workDir "docProps\core.xml"), $coreXml, [System.Text.UTF8Encoding]::new($false))
[System.IO.File]::WriteAllText((Join-Path $workDir "docProps\app.xml"), $appXml, [System.Text.UTF8Encoding]::new($false))

if (Test-Path $outPath) { Remove-Item -LiteralPath $outPath -Force }
Add-Type -AssemblyName System.IO.Compression.FileSystem
$zip = [System.IO.Compression.ZipFile]::Open($outPath, [System.IO.Compression.ZipArchiveMode]::Create)
try {
  $entries = @(
    "[Content_Types].xml",
    "_rels\.rels",
    "word\document.xml",
    "word\_rels\document.xml.rels",
    "docProps\core.xml",
    "docProps\app.xml"
  )
  foreach ($rel in $entries) {
    $full = Join-Path $workDir $rel
    [void][System.IO.Compression.ZipFile]::CreateEntryFromFile($zip, $full, $rel.Replace('\', '/'))
  }
}
finally { $zip.Dispose() }

Remove-Item -LiteralPath $workDir -Recurse -Force
Write-Host "Wrote: $outPath"
