# Hướng dẫn Push Code lên GitHub

Chạy các lệnh sau trong terminal:

```bash
cd /Users/ducna/messenger-api-example

# 1. Khởi tạo git repository (nếu chưa có)
git init

# 2. Cấu hình git (thay email của bạn)
git config user.name "NguyenAnhDucDev"
git config user.email "your-email@example.com"

# 3. Thêm remote
git remote add origin https://github.com/NguyenAnhDucDev/bot_referral_artimind.git

# 4. Add các file (gitignore sẽ tự động loại trừ .env, bot.json, node_modules)
git add .

# 5. Commit
git commit -m "Initial commit: Messenger bot with referral system, MySQL database, Adjust integration, and Google Sheets message scheduler"

# 6. Đổi tên branch thành main
git branch -M main

# 7. Push lên GitHub (sẽ yêu cầu nhập username/password hoặc token)
git push -u origin main
```

**Lưu ý:**
- File `.env` và `bot.json` sẽ KHÔNG được commit (đã có trong .gitignore)
- Nếu GitHub yêu cầu authentication, bạn có thể cần tạo Personal Access Token từ GitHub Settings > Developer settings > Personal access tokens

