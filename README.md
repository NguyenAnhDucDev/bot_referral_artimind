# Messenger Bot - Referral System

Bot Messenger với hệ thống referral, tích hợp MySQL, Adjust, và Google Sheets cho message scheduling.

## Tính năng

- ✅ Tự động tạo referral link cho mỗi user (PSID)
- ✅ Lưu trữ dữ liệu trong MySQL
- ✅ Tích hợp Adjust để tracking download/subscribe
- ✅ Follow-up messaging tự động từ Google Sheets
- ✅ Dashboard quản lý rewards (HTML table)

## Cài đặt

1. Clone repository:
```bash
git clone https://github.com/NguyenAnhDucDev/bot_referral_artimind.git
cd bot_referral_artimind
```

2. Cài đặt dependencies:
```bash
npm install
```

3. Cấu hình `.env`:
```env
# Facebook Messenger
PAGE_ACCESS_TOKEN=your_page_access_token
VERIFY_TOKEN=your_verify_token

# Server
PORT=3000

# MySQL
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=your_password
DB_NAME=messenger_bot

# Adjust
ADJUST_API_TOKEN=your_adjust_api_token
ADJUST_APP_TOKEN=your_adjust_app_token

# Referral Link
REFERRAL_BASE_URL=https://artimind.go.link/?adj_t=...

# Google Sheets
GOOGLE_SHEET_ID=your_sheet_id
GOOGLE_SHEET_RANGE=sheetchat!A:D
MESSAGE_TEMPLATE_REFRESH_MINUTES=60
MESSAGE_WORKER_INTERVAL_SECONDS=300
```

4. Tạo file `bot.json` với Google Service Account credentials (để đọc Google Sheets)

5. Tạo database và table:
```bash
mysql -u root -p < create_table.sql
```

6. Chạy bot:
```bash
npm start
```

## Cấu trúc

- `app.js` - Main application, webhook handlers
- `database.js` - MySQL database operations
- `messenger.js` - Facebook Send API wrapper
- `messageScheduler.js` - Follow-up message scheduler từ Google Sheets
- `adjust.js` - Adjust integration
- `webpages.js` - Landing page generator
- `public/rewards.html` - Dashboard quản lý rewards

## License

MIT

