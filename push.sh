#!/bin/bash
MESSAGE=${1:-"Update"}
git config user.name "Jeanaih"
git config user.email "jeanaih016@gmail.com"
if ! git remote | grep -q origin; then
    git remote add origin https://github.com/jeanaih/cook.git
fi
git add .
if git diff --quiet --cached; then
    echo "No changes to commit."
else
    git commit -m "$MESSAGE"
    git push origin main
    echo "Pushed to GitHub."
fi
