[CmdletBinding()]
param(
  [string]$SourcePath,
  [string]$OutputPath
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

Add-Type -AssemblyName System.Drawing

$root = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
if ([string]::IsNullOrWhiteSpace($SourcePath)) {
  $SourcePath = Join-Path $root 'src\renderer\assets\pet-book-body-v5-alpha.png'
}
if ([string]::IsNullOrWhiteSpace($OutputPath)) {
  $OutputPath = Join-Path $root 'build\icon.ico'
}

$sourceFullPath = [IO.Path]::GetFullPath($SourcePath)
$outputFullPath = [IO.Path]::GetFullPath($OutputPath)
$outputDirectory = Split-Path -Parent $outputFullPath
$sizes = @(16, 32, 48, 64, 128, 256)
$images = [Collections.Generic.List[byte[]]]::new()

if (-not (Test-Path -LiteralPath $sourceFullPath -PathType Leaf)) {
  throw "Icon source was not found: $sourceFullPath"
}

[IO.Directory]::CreateDirectory($outputDirectory) | Out-Null
$source = [Drawing.Bitmap]::FromFile($sourceFullPath)

try {
  foreach ($size in $sizes) {
    $bitmap = [Drawing.Bitmap]::new(
      $size,
      $size,
      [Drawing.Imaging.PixelFormat]::Format32bppArgb
    )

    try {
      $graphics = [Drawing.Graphics]::FromImage($bitmap)
      try {
        $graphics.Clear([Drawing.Color]::Transparent)
        $graphics.CompositingMode = [Drawing.Drawing2D.CompositingMode]::SourceCopy
        $graphics.CompositingQuality = [Drawing.Drawing2D.CompositingQuality]::HighQuality
        $graphics.InterpolationMode = [Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
        $graphics.PixelOffsetMode = [Drawing.Drawing2D.PixelOffsetMode]::HighQuality
        $graphics.SmoothingMode = [Drawing.Drawing2D.SmoothingMode]::HighQuality
        $graphics.DrawImage(
          $source,
          [Drawing.Rectangle]::new(0, 0, $size, $size),
          0,
          0,
          $source.Width,
          $source.Height,
          [Drawing.GraphicsUnit]::Pixel
        )
      } finally {
        $graphics.Dispose()
      }

      $stream = [IO.MemoryStream]::new()
      try {
        $bitmap.Save($stream, [Drawing.Imaging.ImageFormat]::Png)
        $images.Add($stream.ToArray())
      } finally {
        $stream.Dispose()
      }
    } finally {
      $bitmap.Dispose()
    }
  }
} finally {
  $source.Dispose()
}

$iconStream = [IO.MemoryStream]::new()
$writer = [IO.BinaryWriter]::new($iconStream)

try {
  $writer.Write([uint16]0)
  $writer.Write([uint16]1)
  $writer.Write([uint16]$images.Count)

  $imageOffset = 6 + (16 * $images.Count)
  for ($index = 0; $index -lt $images.Count; $index += 1) {
    $size = $sizes[$index]
    $image = $images[$index]
    $dimension = if ($size -eq 256) { 0 } else { $size }

    $writer.Write([byte]$dimension)
    $writer.Write([byte]$dimension)
    $writer.Write([byte]0)
    $writer.Write([byte]0)
    $writer.Write([uint16]1)
    $writer.Write([uint16]32)
    $writer.Write([uint32]$image.Length)
    $writer.Write([uint32]$imageOffset)
    $imageOffset += $image.Length
  }

  foreach ($image in $images) {
    $writer.Write($image)
  }

  $writer.Flush()
  [IO.File]::WriteAllBytes($outputFullPath, $iconStream.ToArray())
} finally {
  $writer.Dispose()
  $iconStream.Dispose()
}

Write-Host "Generated Windows icon: $outputFullPath"
