// Facebook Messenger Bot for Glitch.com
// Main app.js file - Focused on Messenger Bot functionality

require('dotenv').config();
const express = require('express');
const body_parser = require('body-parser');
const path = require('path');

// Import modules
const { initializeDatabase, saveReferral, getAllReferrals, getReferralByPSID, closeDatabase, updateMessageProgress } = require('./database');
const { generateReferralCode, getLandingPage } = require('./webpages');
const { handleAdjustWebhook, pullAdjustData, updateCountsFromAdjustData } = require('./adjust');
const { sendMessage } = require('./messenger');
const { startFollowupScheduler, handleImmediateReferral } = require('./messageScheduler');

const app = express();
const port = process.env.PORT || 3000;

// Parse application/json
app.use(body_parser.json());

// Serve static assets
app.use(express.static(path.join(__dirname, 'public')));

// Initialize database on startup
initializeDatabase()
  .then(() => {
    startFollowupScheduler(sendMessage);
  })
  .catch((error) => {
    console.error('Failed to initialize database:', error);
  });

// ========================================
// FACEBOOK MESSENGER BOT ENDPOINTS
// ========================================

// Facebook verification endpoint
app.get('/webhook', (req, res) => {
  console.log('get webhook');
  console.log(req.body);
  
  // Parse verify_token from query parameter
  const verify_token = process.env.VERIFY_TOKEN;
  
  // Parse query params
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];
  
  // Check if token and mode is in the query string of the request
  if (mode && token) {
    // Check the mode and token sent are correct
    if (mode === 'subscribe' && token === verify_token) {
      // Respond with the challenge token from the request
      console.log('WEBHOOK_VERIFIED');
      res.status(200).send(challenge);
    } else {
      // Respond with '403 Forbidden' if verify tokens do not match
      res.sendStatus(403);
    }
  } else {
    // Return a '404 Not Found' if mode or token is missing
    res.sendStatus(404);
  }
});

// Facebook webhook endpoint for receiving messages
app.post('/webhook', (req, res) => {
  console.log('webhook');
  console.log(req.body)
  
  const body = req.body;

  if (body.object === 'page') {
    body.entry.forEach(entry => {
      console.log(entry);
      // Gets the message
      const webhook_event = entry.messaging[0];
      console.log(webhook_event);

      // Get the sender's Page Scoped ID (PSID)
      const sender_psid = webhook_event.sender.id;
      console.log('Sender PSID: ' + sender_psid);

      // Check if the event is a message or postback and
      // pass the event to the appropriate handler function
      if (webhook_event.message ) {
        handleMessage(sender_psid, webhook_event.message);
      }
    });

    // Return a '200 OK' response to all requests
    res.status(200).send('EVENT_RECEIVED');
  } else {
    // Return a '404 Not Found' if event is not from a page subscription
    res.sendStatus(404);
  }
});

// ========================================
// MESSENGER BOT MESSAGE HANDLING
// ========================================

// Handle messages
async function handleMessage(sender_psid) {
  const base_url = process.env.REFERRAL_BASE_URL || 'https://your-app.com/ref/';
  try {
    let referral = await getReferralByPSID(sender_psid);
    if (!referral) {
      const referral_code = generateReferralCode();
      const referral_link = `${base_url}${referral_code}`;
      await saveReferral(sender_psid, referral_link);
      referral = await getReferralByPSID(sender_psid);
      console.log(`New referral created for PSID ${sender_psid}`);
    } else {
      console.log(`Existing referral found for PSID ${sender_psid}`);
    }

    const sent = await handleImmediateReferral(referral);
    if (!sent) {
      const fallbackLink = appendPsidToLink(referral.referral_link, sender_psid);
      await sendMessage(sender_psid, {
        text: `Here is your unique referral link: ${fallbackLink}\n\nShare this link with friends to earn rewards!`
      });
      const nextStep = (referral.message_step || 0) + 1;
      await updateMessageProgress(sender_psid, nextStep).catch(() => {});
    }
  } catch (error) {
    console.error('Error handling referral message:', error);
    await sendMessage(sender_psid, {
      text: 'Sorry, there was an error generating your referral link. Please try again later.'
    }).catch(() => {});
  }
}

function appendPsidToLink(link, psid) {
  if (!link || !psid) return link;
  if (link.includes('psid=')) {
    return link.replace(/psid=[^&]*/i, `psid=${encodeURIComponent(psid)}`);
  }
  const separator = link.includes('?') ? '&' : '?';
  return `${link}${separator}psid=${encodeURIComponent(psid)}`;
}

// ========================================
// WEB PAGES AND API ENDPOINTS
// ========================================

// Simple landing page
app.get('/', (req, res) => {
  res.send(getLandingPage());
});

// Rewards distribution endpoint
app.get('/rewards', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'rewards.html'));
});

// API endpoint to get all referrals
app.get('/api/referrals', async (req, res) => {
  try {
    const referrals = await getAllReferrals();
    res.json(referrals);
  } catch (error) {
    console.error('Error reading referrals:', error);
    res.status(500).json({ error: 'Failed to read referrals' });
  }
});

// ========================================
// ADJUST INTEGRATION ENDPOINTS
// ========================================

// Webhook endpoint để nhận dữ liệu từ Adjust
app.post('/api/adjust/webhook', handleAdjustWebhook);

// API endpoint để pull dữ liệu từ Adjust (manual trigger)
app.post('/api/adjust/pull', async (req, res) => {
  try {
    const { adjust_id, start_date, end_date } = req.body;
    
    if (!adjust_id) {
      return res.status(400).json({ error: 'Adjust ID is required' });
    }
    
    const data = await pullAdjustData(adjust_id, start_date, end_date);
    
    res.json({ 
      success: true, 
      message: 'Data pulled from Adjust successfully',
      data: data
    });
    
  } catch (error) {
    console.error('Error pulling Adjust data:', error);
    res.status(500).json({ error: 'Failed to pull data from Adjust' });
  }
});

// API endpoint để cập nhật counts từ Adjust data
app.post('/api/adjust/update-counts', async (req, res) => {
  try {
    const { adjust_id, download_count, sub_count } = req.body;
    
    if (!adjust_id) {
      return res.status(400).json({ error: 'Adjust ID is required' });
    }
    
    const referral = await updateCountsFromAdjustData(adjust_id, download_count, sub_count);
    
    if (!referral) {
      return res.status(404).json({ error: 'Referral not found for this Adjust ID' });
    }
    
    res.json({ 
      success: true, 
      message: 'Counts updated successfully',
      referral: referral
    });
    
  } catch (error) {
    console.error('Error updating counts:', error);
    res.status(500).json({ error: 'Failed to update counts' });
  }
});

// ========================================
// REWARD ENDPOINTS
// ========================================

// API endpoint to send rewards to users
app.post('/api/send-reward', async (req, res) => {
  try {
    const { psid, referral_link, reward_message } = req.body;
    
    if (!psid || !referral_link) {
      return res.status(400).json({ error: 'PSID and referral link are required' });
    }
    
    // Default reward message if not provided
    const message = reward_message || `🎉 Congratulations! You've earned a reward for sharing your referral link: ${referral_link}\n\nThank you for helping us grow!`;
    
    await sendMessage(psid, { text: message });
    
    // Log the reward distribution
    console.log(`Reward sent to PSID: ${psid} with referral link: ${referral_link}`);
    
    res.json({ 
      success: true, 
      message: 'Reward sent successfully',
      psid: psid,
      referral_link: referral_link
    });
    
  } catch (error) {
    console.error('Error sending reward:', error);
    res.status(500).json({ error: 'Failed to send reward' });
  }
});

// ========================================
// SERVER STARTUP AND SHUTDOWN
// ========================================

// Start server
app.listen(port, () => {
  console.log(`Messenger Bot server is listening on port ${port}`);
});

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('Closing database connection...');
  try {
    await closeDatabase();
  } catch (error) {
    console.error('Error during shutdown:', error);
  }
  process.exit(0);
});