Add-Type -AssemblyName System.Drawing

$assetDir = Join-Path $PSScriptRoot '..\src\renderer\assets'
New-Item -ItemType Directory -Force -Path $assetDir | Out-Null

function Save-PageMask {
  param(
    [System.Drawing.Drawing2D.GraphicsPath]$Shape,
    [int]$Width,
    [int]$Height,
    [string]$OutputPath
  )

  $bitmap = [System.Drawing.Bitmap]::new(
    $Width,
    $Height,
    [System.Drawing.Imaging.PixelFormat]::Format32bppArgb
  )
  $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
  $brush = [System.Drawing.SolidBrush]::new(
    [System.Drawing.Color]::FromArgb(255, 255, 255, 255)
  )

  try {
    $graphics.Clear([System.Drawing.Color]::Transparent)
    $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
    $graphics.FillPath($brush, $Shape)
    $bitmap.Save($OutputPath, [System.Drawing.Imaging.ImageFormat]::Png)
  }
  finally {
    $brush.Dispose()
    $graphics.Dispose()
    $bitmap.Dispose()
    $Shape.Dispose()
  }
}

$left = [System.Drawing.Drawing2D.GraphicsPath]::new()
$left.AddBezier(8, 4, 3, 90, 3, 325, 12, 394)
$left.AddBezier(12, 394, 110, 390, 210, 380, 248, 360)
$left.AddBezier(248, 360, 257, 285, 257, 75, 250, 4)
$left.AddLine(250, 4, 8, 4)
$left.CloseFigure()
Save-PageMask `
  -Shape $left `
  -Width 260 `
  -Height 400 `
  -OutputPath (Join-Path $assetDir 'page-mask-left.png')

$right = [System.Drawing.Drawing2D.GraphicsPath]::new()
$right.AddBezier(90, 360, 130, 380, 230, 390, 328, 394)
$right.AddBezier(328, 394, 337, 325, 337, 90, 332, 4)
$right.AddLine(332, 4, 10, 4)
$right.AddBezier(10, 4, 3, 75, 3, 285, 12, 360)
$right.AddBezier(12, 360, 35, 366, 62, 365, 90, 360)
$right.CloseFigure()
Save-PageMask `
  -Shape $right `
  -Width 340 `
  -Height 400 `
  -OutputPath (Join-Path $assetDir 'page-mask-right.png')
