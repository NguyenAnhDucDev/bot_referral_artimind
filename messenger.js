const request = require('request');

function sendMessage(psid, message) {
  return new Promise((resolve, reject) => {
    if (!psid) {
      return reject(new Error('Missing PSID for sendMessage'));
    }

    if (!message) {
      return reject(new Error('Missing message payload for sendMessage'));
    }

    const page_access_token = process.env.PAGE_ACCESS_TOKEN;
    if (!page_access_token) {
      return reject(new Error('PAGE_ACCESS_TOKEN is not configured'));
    }

    request({
      uri: 'https://graph.facebook.com/v18.0/me/messages',
      qs: { access_token: page_access_token },
      method: 'POST',
      json: {
        recipient: { id: psid },
        message
      }
    }, (err, res, body) => {
      if (err) {
        console.error('Unable to send message:', err);
        return reject(err);
      }

      if (res.statusCode !== 200) {
        console.error('Send API failed:', res.statusCode, body);
        return reject(new Error(`Send API failed with status ${res.statusCode}`));
      }

      if (body && body.error) {
        console.error('Send API returned error:', body.error);
        return reject(new Error(body.error.message || 'Unknown Send API error'));
      }

      console.log('Message sent successfully:', body);
      resolve(body);
    });
  });
}

module.exports = {
  sendMessage
};

