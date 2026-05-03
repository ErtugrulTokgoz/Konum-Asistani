$WshShell = New-Object -comObject WScript.Shell
$DesktopPath = [Environment]::GetFolderPath("Desktop")
$AppPath = Join-Path $DesktopPath "KonumAsistanı"
$ShortcutPath = Join-Path $DesktopPath "Konum Asistanı.lnk"

$Shortcut = $WshShell.CreateShortcut($ShortcutPath)
$Shortcut.TargetPath = Join-Path $AppPath "baslat.bat"
$Shortcut.WorkingDirectory = $AppPath
$Shortcut.IconLocation = Join-Path $AppPath "icon.ico"
$Shortcut.Save()
