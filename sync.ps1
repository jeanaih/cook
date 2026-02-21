# GitHub Sync Script for Windows
# Usage: .\sync.ps1 "Your commit message"

param (
    [string]$Message = "Update $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')"
)

Write-Host "--- Git Sync Start ---" -ForegroundColor Cyan

# 1. Check if it's a git repo
if (!(Test-Path .git)) {
    Write-Host "Error: Not a git repository!" -ForegroundColor Red
    exit
}

# 2. Add all changes
Write-Host "Adding changes..."
git add .

# 3. Check for staging changes
$status = git status --porcelain
if ([string]::IsNullOrWhiteSpace($status)) {
    Write-Host "No changes to commit." -ForegroundColor Yellow
} else {
    Write-Host "Committing changes..."
    git commit -m "$Message"
}

# 4. Get current branch name
$branch = git rev-parse --abbrev-ref HEAD

# 5. Try to push
Write-Host "Pushing to $branch..."
$pushResult = git push origin $branch 2>&1

if ($LASTEXITCODE -ne 0) {
    Write-Host "Push failed on $branch. Checking for branch protection rules..." -ForegroundColor Yellow
    
    if ($pushResult -match "GH013" -or $pushResult -match "protected branch") {
        Write-Host "Branch '$branch' is protected on GitHub. You probably need to use a Pull Request." -ForegroundColor Cyan
        $tempBranch = "update-" + (Get-Date -Format "yyyyMMdd-HHmm")
        Write-Host "Attempting to push to a new branch: $tempBranch" -ForegroundColor Gray
        
        git checkout -b $tempBranch
        git push origin $tempBranch
        
        if ($LASTEXITCODE -eq 0) {
            Write-Host "Success! Changes pushed to branch '$tempBranch'." -ForegroundColor Green
            Write-Host "Please go to GitHub and create a Pull Request to merge '$tempBranch' into '$branch'." -ForegroundColor Cyan
        } else {
            Write-Host "Failed to push even to a new branch. Please check your GitHub permissions or SSH/Token setup." -ForegroundColor Red
        }
        
        # Switch back to original branch
        git checkout $branch
    } else {
        Write-Host "Error details:" -ForegroundColor Red
        $pushResult | Out-String | Write-Host
    }
} else {
    Write-Host "Successfully pushed to GitHub!" -ForegroundColor Green
}

Write-Host "--- Git Sync End ---" -ForegroundColor Cyan
