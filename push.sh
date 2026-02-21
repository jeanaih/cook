#!/bin/bash
git config user.name "Jeanaih"
git config user.email "jeanaih016@gmail.com"
if ! git remote | grep -q origin; then
    git remote add origin https://github.com/jeanaih/cook.git
fi
git add .
git commit -m "Update"
git push origin main
