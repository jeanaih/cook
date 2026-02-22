# git push script
# Usage: ./push.ps1 "message"

$message = $args[0]
if (!$message) { $message = "Update $(Get-Date)" }

Write-Host "Adding files..." -ForegroundColor Cyan
git add .

Write-Host "Committing..." -ForegroundColor Cyan
git commit -m $message

$branch = git branch --show-current
Write-Host "Pushing to $branch..." -ForegroundColor Cyan
git push origin $branch

if ($LASTEXITCODE -ne 0) {
    Write-Host "Push failed. Trying to fix branch lock issue..." -ForegroundColor Yellow
    git fetch origin --prune
    git push origin $branch
}

Write-Host "Done!" -ForegroundColor Green
