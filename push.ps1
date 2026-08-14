Set-Location -Path $PSScriptRoot

Write-Host "=== Current status ===" -ForegroundColor Cyan
git status --short

$changes = git status --porcelain
if (-not $changes) {
    Write-Host "No changes to push. Already in sync." -ForegroundColor Yellow
    Read-Host "Press Enter to close"
    exit
}

$message = Read-Host "Commit message"
if ([string]::IsNullOrWhiteSpace($message)) {
    $message = "Update: " + (Get-Date -Format "yyyy-MM-dd HH:mm")
    Write-Host "Empty message. Using: $message" -ForegroundColor Yellow
}

git add .
git commit -m "$message"
git push

if ($LASTEXITCODE -eq 0) {
    Write-Host "Done! Changes are on GitHub." -ForegroundColor Green
} else {
    Write-Host "Push failed. Try 'git pull' first, then run again." -ForegroundColor Red
}

Read-Host "Press Enter to close"
