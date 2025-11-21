const { saveReferral } = require('./database');

// Generate unique referral code
function generateReferralCode() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = '';
  for (let i = 0; i < 8; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

// Main landing page
function getLandingPage() {
  return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Messenger Bot Server</title>
        <style>
            body {
                font-family: Arial, sans-serif;
                max-width: 600px;
                margin: 0 auto;
                padding: 40px 20px;
                background-color: #f5f5f5;
            }
            .container {
                background: white;
                padding: 40px;
                border-radius: 10px;
                box-shadow: 0 2px 10px rgba(0,0,0,0.1);
                text-align: center;
            }
            h1 {
                color: #333;
                margin-bottom: 20px;
            }
            .status {
                color: #28a745;
                font-weight: bold;
                margin-bottom: 30px;
            }
            .rewards-link {
                display: inline-block;
                background: #007bff;
                color: white;
                text-decoration: none;
                padding: 15px 30px;
                border-radius: 5px;
                font-weight: bold;
                transition: background 0.3s;
            }
            .rewards-link:hover {
                background: #0056b3;
            }
        </style>
    </head>
    <body>
        <div class="container">
            <h1>🤖 Messenger Bot Server</h1>
            <div class="status">✅ Your Messenger Bot Server is running!</div>
            <p>Users can interact with your bot on Facebook Messenger to get referral codes.</p>
            <br>
            <a href="/rewards" class="rewards-link">🎁 Manage Rewards Distribution</a>
        </div>
    </body>
    </html>
  `;
}

module.exports = {
  generateReferralCode,
  getLandingPage
}; 