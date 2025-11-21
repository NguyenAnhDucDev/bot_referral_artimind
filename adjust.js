// Adjust API Integration
// Xử lý webhook và API calls từ Adjust

const request = require('request');
const { updateReferralCounts, getReferralByAdjustId, getReferralByPSID, updateAdjustId, appendAdjustId } = require('./database');

// Adjust API Configuration
const ADJUST_API_TOKEN = process.env.ADJUST_API_TOKEN;
const ADJUST_APP_TOKEN = process.env.ADJUST_APP_TOKEN;
const ADJUST_WEBHOOK_SECRET = process.env.ADJUST_WEBHOOK_SECRET;

/**
 * Xử lý webhook từ Adjust
 * Adjust sẽ gửi POST request khi có event (download, subscription, etc.)
 */
async function handleAdjustWebhook(req, res) {
  try {
    const body = req.body;
    
    // Verify webhook signature nếu có secret
    if (ADJUST_WEBHOOK_SECRET) {
      // TODO: Implement signature verification
      // const signature = req.headers['x-adjust-signature'];
      // if (!verifySignature(body, signature, ADJUST_WEBHOOK_SECRET)) {
      //   return res.status(401).json({ error: 'Invalid signature' });
      // }
    }
    
    console.log('Adjust webhook received:', JSON.stringify(body, null, 2));
    
    // Adjust webhook format có thể khác nhau tùy cấu hình
    // Ví dụ format phổ biến:
    const adjust_id = body.adjust_id || body.adid || body.adjust_id;
    const event_type = body.event_type || body.event || body.event_token;
    const referral_link = body.referral_link || body.link || body.referral;
    
    if (!adjust_id) {
      console.warn('No Adjust ID found in webhook');
      return res.status(400).json({ error: 'Missing Adjust ID' });
    }
    
    // Tìm referral theo Adjust_id
    let referral = await getReferralByAdjustId(adjust_id);
    
    // Nếu không tìm thấy, thử tìm theo referral_link
    if (!referral && referral_link) {
      // Có thể cần thêm hàm tìm theo referral_link
      console.log(`Referral not found by Adjust_id: ${adjust_id}, trying referral_link`);
    }
    
    // Xử lý các loại event
    if (event_type) {
      switch (event_type.toLowerCase()) {
        case 'download':
        case 'install':
        case 'app_install':
          // Tăng số lượt download
          if (referral) {
            const current_downloads = referral.referral_count_dowload || 0;
            await updateReferralCounts(referral.PSID, current_downloads + 1, null);
            console.log(`Download count updated for Adjust_id: ${adjust_id}`);
            await appendAdjustId(referral.PSID, adjust_id, 'download');
          }
          break;
          
        case 'subscription':
        case 'subscribe':
        case 'purchase':
          // Tăng số lượt subscribe
          if (referral) {
            const current_subs = referral.referral_count_sub || 0;
            await updateReferralCounts(referral.PSID, null, current_subs + 1);
            console.log(`Subscribe count updated for Adjust_id: ${adjust_id}`);
            await appendAdjustId(referral.PSID, adjust_id, 'sub');
          }
          break;
          
        default:
          console.log(`Unknown event type: ${event_type}`);
      }
    }
    
    // Trả lời Adjust
    res.status(200).json({ 
      success: true, 
      message: 'Webhook processed successfully' 
    });
    
  } catch (error) {
    console.error('Error processing Adjust webhook:', error);
    res.status(500).json({ error: 'Failed to process webhook' });
  }
}

/**
 * Pull dữ liệu từ Adjust API
 * Gọi Adjust API để lấy thống kê về downloads và subscribes
 */
async function pullAdjustData(adjust_id, start_date, end_date) {
  return new Promise((resolve, reject) => {
    if (!ADJUST_API_TOKEN || !ADJUST_APP_TOKEN) {
      return reject(new Error('Adjust API credentials not configured'));
    }
    
    const url = `https://api.adjust.com/kpis/v1/${ADJUST_APP_TOKEN}/events`;
    const params = {
      start_date: start_date || new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // 7 days ago
      end_date: end_date || new Date().toISOString().split('T')[0],
      event_tokens: 'download,subscription', // Event tokens từ Adjust dashboard
      grouping: 'day',
      kpis: 'events'
    };
    
    request({
      url: url,
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${ADJUST_API_TOKEN}`,
        'Content-Type': 'application/json'
      },
      qs: params
    }, async (error, response, body) => {
      if (error) {
        console.error('Error calling Adjust API:', error);
        return reject(error);
      }
      
      if (response.statusCode !== 200) {
        console.error('Adjust API error:', response.statusCode, body);
        return reject(new Error(`Adjust API returned ${response.statusCode}`));
      }
      
      try {
        const data = JSON.parse(body);
        console.log('Adjust API response:', JSON.stringify(data, null, 2));
        
        // Xử lý dữ liệu và cập nhật database
        // Format của Adjust API response có thể khác nhau
        // Bạn cần điều chỉnh logic này theo format thực tế từ Adjust
        
        resolve(data);
      } catch (parseError) {
        console.error('Error parsing Adjust API response:', parseError);
        reject(parseError);
      }
    });
  });
}

/**
 * Cập nhật referral counts từ Adjust data
 */
async function updateCountsFromAdjustData(adjust_id, download_count, sub_count) {
  try {
    const referral = await getReferralByAdjustId(adjust_id);
    
    if (!referral) {
      console.warn(`Referral not found for Adjust_id: ${adjust_id}`);
      return null;
    }
    
    await updateReferralCounts(referral.PSID, download_count, sub_count);
    console.log(`Updated counts for Adjust_id ${adjust_id}: downloads=${download_count}, subscribes=${sub_count}`);
    
    return referral;
  } catch (error) {
    console.error('Error updating counts from Adjust data:', error);
    throw error;
  }
}

module.exports = {
  handleAdjustWebhook,
  pullAdjustData,
  updateCountsFromAdjustData
};

