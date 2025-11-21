const mysql = require('mysql2/promise');

// Database connection configuration from environment variables
const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'messenger_bot',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
};

// Create connection pool
let pool;

function parseJsonArray(value) {
  if (!value) return [];
  if (Array.isArray(value)) return value;
  try {
    const parsed = typeof value === 'string' ? JSON.parse(value) : value;
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    console.warn('Failed to parse JSON array column:', error);
    return [];
  }
}

function normalizeReferralRow(row) {
  if (!row) return null;
  return {
    ...row,
    adjust_id_user_refer_download: parseJsonArray(row.adjust_id_user_refer_download),
    adjust_id_user_refer_sub: parseJsonArray(row.adjust_id_user_refer_sub),
    message_step: Number(row.message_step) || 0,
    last_message_sent_at: row.last_message_sent_at
  };
}

function ensureArrayPayload(value) {
  if (value === undefined || value === null) return null;
  if (Array.isArray(value)) return value;
  if (typeof value === 'string' && value.length > 0) return [value];
  return null;
}

// Initialize database connection and create table
async function initializeDatabase() {
  try {
    // Create pool
    pool = mysql.createPool(dbConfig);
    
    // Test connection
    const connection = await pool.getConnection();
    console.log('MySQL connected successfully');
    connection.release();
    
    // Create table if not exists
    await pool.execute(`
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
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    await ensureLegacyColumnsMigrated();
    
    console.log('Table referrals created/verified successfully');
    
    // Check if table is empty and add demo user
    const [rows] = await pool.execute('SELECT COUNT(*) as count FROM referrals');
    
    if (rows[0].count === 0) {
      const demo_psid = '9446795088699318';
      const base_url = process.env.REFERRAL_BASE_URL || 'https://your-app.com/ref/';
      const demo_referral_link = `${base_url}DEMO1234`;
      
      await pool.execute(
        `INSERT INTO referrals (PSID, referral_link, referral_count_dowload, referral_count_sub, created_at, updated_at) 
         VALUES (?, ?, 0, 0, NOW(), NOW())`,
        [demo_psid, demo_referral_link]
      );
      
      console.log(`Demo user added: PSID ${demo_psid} with referral link ${demo_referral_link}`);
    }
    
    console.log('Database initialized successfully');
  } catch (error) {
    console.error('Error initializing database:', error);
    throw error;
  }
}

// Save referral to database
async function saveReferral(psid, referral_link) {
  try {
    const [result] = await pool.execute(
      `INSERT INTO referrals (PSID, referral_link, updated_at) 
       VALUES (?, ?, NOW())
       ON DUPLICATE KEY UPDATE 
         referral_link = VALUES(referral_link),
         updated_at = NOW()`,
      [psid, referral_link]
    );
    
    console.log(`Referral saved: PSID ${psid} -> ${referral_link}`);
    return result.insertId;
  } catch (error) {
    console.error('Error saving referral:', error);
    throw error;
  }
}

// Update referral counts
async function updateReferralCounts(psid, download_count = null, sub_count = null) {
  try {
    let updateFields = [];
    let values = [];
    
    if (download_count !== null) {
      updateFields.push('referral_count_dowload = ?');
      values.push(download_count);
    }
    
    if (sub_count !== null) {
      updateFields.push('referral_count_sub = ?');
      values.push(sub_count);
    }
    
    if (updateFields.length === 0) {
      return;
    }
    
    updateFields.push('updated_at = NOW()');
    values.push(psid);
    
    const [result] = await pool.execute(
      `UPDATE referrals SET ${updateFields.join(', ')} WHERE PSID = ?`,
      values
    );
    
    console.log(`Referral counts updated for PSID: ${psid}`);
    return result.affectedRows;
  } catch (error) {
    console.error('Error updating referral counts:', error);
    throw error;
  }
}

// Get all referrals from database
async function getAllReferrals() {
  try {
    const [rows] = await pool.execute(
      'SELECT * FROM referrals ORDER BY created_at DESC'
    );
    return rows.map(normalizeReferralRow);
  } catch (error) {
    console.error('Error getting referrals:', error);
    throw error;
  }
}

// Get referral by Adjust_id
async function getReferralByAdjustId(adjust_id) {
  try {
    const [rows] = await pool.execute(
      `SELECT * FROM referrals
       WHERE JSON_CONTAINS(COALESCE(adjust_id_user_refer_download, JSON_ARRAY()), JSON_QUOTE(?))
          OR JSON_CONTAINS(COALESCE(adjust_id_user_refer_sub, JSON_ARRAY()), JSON_QUOTE(?))
       LIMIT 1`,
      [adjust_id, adjust_id]
    );
    return rows.length > 0 ? normalizeReferralRow(rows[0]) : null;
  } catch (error) {
    console.error('Error getting referral by Adjust_id:', error);
    throw error;
  }
}

// Get referral by PSID
async function getReferralByPSID(psid) {
  try {
    const [rows] = await pool.execute(
      'SELECT * FROM referrals WHERE PSID = ?',
      [psid]
    );
    return rows.length > 0 ? normalizeReferralRow(rows[0]) : null;
  } catch (error) {
    console.error('Error getting referral by PSID:', error);
    throw error;
  }
}

// Update Adjust IDs (replace arrays)
async function updateAdjustId(psid, payload = {}) {
  try {
    const downloadIds = ensureArrayPayload(payload.adjust_id_user_refer_download ?? payload.downloadIds);
    const subIds = ensureArrayPayload(payload.adjust_id_user_refer_sub ?? payload.subIds);
    
    const setParts = [];
    const values = [];
    
    if (downloadIds !== null) {
      setParts.push('adjust_id_user_refer_download = ?');
      values.push(JSON.stringify(downloadIds));
    }
    
    if (subIds !== null) {
      setParts.push('adjust_id_user_refer_sub = ?');
      values.push(JSON.stringify(subIds));
    }
    
    if (!setParts.length) {
      return 0;
    }
    
    setParts.push('updated_at = NOW()');
    values.push(psid);
    
    const [result] = await pool.execute(
      `UPDATE referrals SET ${setParts.join(', ')} WHERE PSID = ?`,
      values
    );
    console.log(`Adjust IDs replaced for PSID: ${psid}`);
    return result.affectedRows;
  } catch (error) {
    console.error('Error updating Adjust_id:', error);
    throw error;
  }
}

// Append single Adjust ID
async function appendAdjustId(psid, adjust_id, group = 'download') {
  if (!adjust_id) return 0;
  const column = group === 'sub' ? 'adjust_id_user_refer_sub' : 'adjust_id_user_refer_download';
  const [rows] = await pool.execute(
    `SELECT ${column} FROM referrals WHERE PSID = ?`,
    [psid]
  );
  if (!rows.length) {
    console.warn(`appendAdjustId: PSID not found (${psid})`);
    return 0;
  }
  const current = parseJsonArray(rows[0][column]);
  if (!current.includes(adjust_id)) {
    current.push(adjust_id);
    await pool.execute(
      `UPDATE referrals SET ${column} = ?, updated_at = NOW() WHERE PSID = ?`,
      [JSON.stringify(current), psid]
    );
    console.log(`Adjust ID ${adjust_id} appended to ${column} for PSID ${psid}`);
  }
  return current.length;
}

async function updateMessageProgress(psid, nextStep) {
  try {
    const [result] = await pool.execute(
      'UPDATE referrals SET message_step = ?, last_message_sent_at = NOW(), updated_at = NOW() WHERE PSID = ?',
      [nextStep, psid]
    );
    return result.affectedRows;
  } catch (error) {
    console.error('Error updating message progress:', error);
    throw error;
  }
}

async function ensureLegacyColumnsMigrated() {
  const [downloadCol] = await pool.query(`SHOW COLUMNS FROM referrals LIKE 'adjust_id_user_refer_download'`);
  if (downloadCol.length === 0) {
    await pool.execute(`
      ALTER TABLE referrals
      ADD COLUMN adjust_id_user_refer_download JSON NULL COMMENT 'Danh sách Adjust ID cho download'
    `);
  }
  
  const [subCol] = await pool.query(`SHOW COLUMNS FROM referrals LIKE 'adjust_id_user_refer_sub'`);
  if (subCol.length === 0) {
    await pool.execute(`
      ALTER TABLE referrals
      ADD COLUMN adjust_id_user_refer_sub JSON NULL COMMENT 'Danh sách Adjust ID cho subscribe'
    `);
  }
  
  const [legacy] = await pool.query(`SHOW COLUMNS FROM referrals LIKE 'Adjust_id'`);
  if (legacy.length > 0) {
    await pool.execute(`
      UPDATE referrals
      SET adjust_id_user_refer_download = JSON_ARRAY(Adjust_id)
      WHERE Adjust_id IS NOT NULL
        AND (adjust_id_user_refer_download IS NULL OR JSON_TYPE(adjust_id_user_refer_download) = 'NULL')
    `);
    
    await pool.execute(`ALTER TABLE referrals DROP COLUMN Adjust_id`);
  }

  const [messageStepCol] = await pool.query(`SHOW COLUMNS FROM referrals LIKE 'message_step'`);
  if (messageStepCol.length === 0) {
    await pool.execute(`ALTER TABLE referrals ADD COLUMN message_step INT DEFAULT 0 COMMENT 'Chỉ số tin nhắn đã gửi'`);
  }

  const [lastMessageCol] = await pool.query(`SHOW COLUMNS FROM referrals LIKE 'last_message_sent_at'`);
  if (lastMessageCol.length === 0) {
    await pool.execute(`ALTER TABLE referrals ADD COLUMN last_message_sent_at DATETIME NULL COMMENT 'Thời gian gửi tin nhắn gần nhất'`);
  }
}

// Close database connection pool
async function closeDatabase() {
  try {
    if (pool) {
      await pool.end();
      console.log('Database connection pool closed.');
    }
  } catch (error) {
    console.error('Error closing database:', error);
    throw error;
  }
}

module.exports = {
  initializeDatabase,
  saveReferral,
  getAllReferrals,
  updateReferralCounts,
  getReferralByAdjustId,
  getReferralByPSID,
  updateAdjustId,
  updateMessageProgress,
  appendAdjustId,
  closeDatabase
};
