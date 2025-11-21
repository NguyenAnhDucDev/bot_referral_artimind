-- Script tạo bảng referrals với cấu trúc mới
-- Chạy script này trong MySQL Workbench

USE messenger_bot;

-- Xóa bảng cũ nếu tồn tại (CHỈ CHẠY NẾU BẠN MUỐN XÓA DỮ LIỆU CŨ)
-- DROP TABLE IF EXISTS referrals;

-- Tạo bảng mới với cấu trúc mới
CREATE TABLE IF NOT EXISTS referrals (
  id INT AUTO_INCREMENT PRIMARY KEY,
  PSID VARCHAR(255) UNIQUE NOT NULL COMMENT 'Page Scoped User ID từ Facebook',
  referral_link VARCHAR(500) NOT NULL COMMENT 'Link referral hoặc mã referral',
  referral_count_dowload INT DEFAULT 0 COMMENT 'Số lượt download qua referral',
  referral_count_sub INT DEFAULT 0 COMMENT 'Số lượt subscribe qua referral',
  adjust_id_user_refer_download JSON NULL COMMENT 'Danh sách Adjust ID cho download',
  adjust_id_user_refer_sub JSON NULL COMMENT 'Danh sách Adjust ID cho subscribe',
  message_step INT DEFAULT 0 COMMENT 'Chỉ số tin nhắn đã gửi',
  last_message_sent_at DATETIME NULL COMMENT 'Thời gian gửi tin nhắn gần nhất',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT 'Thời gian tạo',
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT 'Thời gian cập nhật'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Thêm index để tìm kiếm nhanh hơn
CREATE INDEX idx_psid ON referrals(PSID);

-- Kiểm tra bảng đã tạo
SHOW TABLES;
DESCRIBE referrals;

