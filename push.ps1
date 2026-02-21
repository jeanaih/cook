# GitHub Sync Script
# This script handles adding, committing, and pushing your changes to GitHub.
# It automatically handles protected branches (like 'main') by creating a new branch if needed.

param (
    [string]$Message = "Update $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')"
)

Clear-Host
Write-Host "==============================" -ForegroundColor Cyan
Write-Host "   GIT GITHUB SYNC UTILITY" -ForegroundColor Cyan
Write-Host "==============================" -ForegroundColor Cyan

# 1. Ensure we are in a Git repository
if (!(Test-Path .git)) {
    Write-Host "[!] Error: Not a git repository. Please run this inside your project folder." -ForegroundColor Red
    exit
}

# 2. Stage all changes
Write-Host "[+] Staging changes..." -ForegroundColor Gray
git add .

# 3. Commit changes
$status = git status --porcelain
if ([string]::IsNullOrWhiteSpace($status)) {
    Write-Host "[i] No new changes to commit." -ForegroundColor Yellow
} else {
    Write-Host "[+] Committing changes: $Message" -ForegroundColor Gray
    git commit -m "$Message"
}

# 4. Detect Branch
$currentBranch = git branch --show-current
Write-Host "[i] Current branch: $currentBranch" -ForegroundColor Gray

# 5. Attempt Push
Write-Host "[>] Pushing to GitHub..." -ForegroundColor Cyan
$pushError = git push origin $currentBranch 2>&1

if ($LASTEXITCODE -eq 0) {
    Write-Host "[✓] SUCCESS: Changes pushed to '$currentBranch'!" -ForegroundColor Green
} else {
    # Check for Protected Branch (GH013)
    if ($pushError -match "GH013") {
        Write-Host "[!] ALERT: Push to '$currentBranch' was rejected by GitHub Rules." -ForegroundColor Yellow
        Write-Host "    Reason: This branch is likely protected (requires a Pull Request)." -ForegroundColor Gray
        
        $newBranch = "work-" + (Get-Date -Format "MMdd-HHmm")
        Write-Host "[+] Action: Attempting to push to a new branch: $newBranch" -ForegroundColor Gray
        
        git checkout -b $newBranch
        git push origin $newBranch
        
        if ($LASTEXITCODE -eq 0) {
            Write-Host "[✓] SUCCESS: Pushed to new branch '$newBranch'!" -ForegroundColor Green
            Write-Host "    >>> Go to: https://github.com/jeanaih/cook/compare/main...$newBranch" -ForegroundColor Cyan
            Write-Host "    >>> Click 'Create pull request' to merge your changes." -ForegroundColor Cyan
        } else {
            Write-Host "[!] FAILED: Could not push even to a new branch." -ForegroundColor Red
            Write-Host "    Please check your Internet connection or GitHub permissions." -ForegroundColor Gray
        }
        
        # Switch back to the branch we started on
        git checkout $currentBranch
    } else {
        Write-Host "[!] FAILED: Unknown error during push." -ForegroundColor Red
        Write-Host "    Error message: $pushError" -ForegroundColor Gray
    }
}

Write-Host "==============================" -ForegroundColor Cyan
