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
# ========================================
# Facebook Messenger Configuration
# ========================================
# Lấy từ: Facebook Developer → Your App → Messenger → Settings
# Hoặc: Facebook Page → Settings → Messenger Platform → Access Tokens
PAGE_ID=773225415873824
APP_SECRET=850abed02649d0223424d5cce0091bf4
APP_ID=541931148621741
USER_ACCESS_TOKEN=EAAWoW3nD1QcBP4cJz53Yv9Wdaky3mabPkEqZB0ZC0kILqZBqreb1elseURdSWfHpJPNfMXd1yEOmAs7nIeooUyslZBd14wxxwlIumiNpZC56WDWapB3GPLwj32FVDZAN18GnKeaEL9BdyI2iUwYsZCWQ42yeFWZCRrBzLMvHnLY4AVzwlXqyXWULltcpMsjPrF7r
PAGE_ACCESS_TOKEN=EAAWoW3nD1QcBPzM8dqPtc5ZAZALcjBbW2sM0zEgytXwV2hrMazBZChgq5021AXvF51HrcZBZCPY2LPaY7AXhBhjYWEBdWDJoVi6w692LDQB3behXCs0aMhvZCMUG2GaFM4yiQwX5IWYHZC4ltERoAerZBCYg7WgD2abA1ZAUivBoASdXoz8lvlSvtQ5ByFFBb09K2RRZBSz0W9
# curl -s "https://graph.facebook.com/me?access_token=<ACCESS_TOKEN>"
# Tự đặt một chuỗi bất kỳ để verify webhook với Facebook
# Phải giống với token bạn nhập khi setup webhook trong Facebook
VERIFY_TOKEN=0

# ========================================
# Server Configuration
# ========================================
PORT=3000

# ========================================
# MySQL Database Configuration
# ========================================
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=
DB_NAME=messenger_bot

# ========================================
# Adjust API Configuration
# ========================================
# Lấy từ: Adjust Dashboard → Settings → API → Create API Token
ADJUST_API_TOKEN=your_adjust_api_token

# Lấy từ: Adjust Dashboard → Your App → Settings → App Token
ADJUST_APP_TOKEN=your_adjust_app_token

# (Tùy chọn) Secret để verify webhook từ Adjust
ADJUST_WEBHOOK_SECRET=your_webhook_secret_optional

# ========================================
# Referral Link Configuration
# ========================================
# Base URL cho referral links
# Ví dụ: https://your-app.com/ref/ hoặc https://adjust.io/abc123?ref=
# Cần match với cấu hình trong Adjust để track được
REFERRAL_BASE_URL=https://artimind.go.link/?adj_t=1uxslzio&adj_campaign=invite_friends&adj_adgroup=20off_next_purchasse&adj_label=

GOOGLE_SHEET_ID=1M15Mkvil6sp2ODxkHxNqY2TdPeftI1JSRHuKKL4bqPw
GOOGLE_SHEET_RANGE=sheetchat!A:D
MESSAGE_TEMPLATE_REFRESH_MINUTES=60
MESSAGE_WORKER_INTERVAL_SECONDS=60
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

