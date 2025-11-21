#!/bin/bash

cd /Users/ducna/messenger-api-example

# Kiểm tra git đã được init chưa
if [ ! -d .git ]; then
    echo "Initializing git repository..."
    git init
fi

# Cấu hình git (nếu chưa có)
git config user.name "NguyenAnhDucDev" || true
git config user.email "ducna@example.com" || true

# Thêm remote
git remote remove origin 2>/dev/null || true
git remote add origin https://github.com/NguyenAnhDucDev/bot_referral_artimind.git

# Add tất cả các file (gitignore sẽ tự động loại trừ .env, bot.json, node_modules)
echo "Adding files..."
git add .

# Kiểm tra xem có file nào được add không
if git diff --cached --quiet; then
    echo "No changes to commit. Checking if already committed..."
    if [ -z "$(git log -1 2>/dev/null)" ]; then
        echo "No commits found. Creating initial commit..."
        git commit -m "Initial commit: Messenger bot with referral system, MySQL database, Adjust integration, and Google Sheets message scheduler"
    else
        echo "Already committed. Current commit:"
        git log -1 --oneline
    fi
else
    echo "Committing changes..."
    git commit -m "Initial commit: Messenger bot with referral system, MySQL database, Adjust integration, and Google Sheets message scheduler"
fi

# Đổi tên branch thành main
git branch -M main

# Push lên GitHub
echo "Pushing to GitHub..."
git push -u origin main

echo "Done! Check https://github.com/NguyenAnhDucDev/bot_referral_artimind"

