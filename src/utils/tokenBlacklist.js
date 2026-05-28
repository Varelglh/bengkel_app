const fs = require('fs');
const path = require('path');

const FILE = path.join(__dirname, '../../.token_blacklist.json');

let cache = { tokens: [] };

function load() {
  try {
    if (fs.existsSync(FILE)) {
      const raw = fs.readFileSync(FILE, 'utf8');
      cache = JSON.parse(raw || '{"tokens":[] }');
    }
  } catch (e) {
    console.error('Failed to load token blacklist', e);
    cache = { tokens: [] };
  }
}

function save() {
  try {
    fs.writeFileSync(FILE, JSON.stringify(cache), 'utf8');
  } catch (e) {
    console.error('Failed to save token blacklist', e);
  }
}

function cleanup() {
  const now = Math.floor(Date.now() / 1000);
  cache.tokens = cache.tokens.filter((t) => t.exp > now);
  save();
}

load();
setInterval(cleanup, 1000 * 60 * 60); // cleanup hourly

module.exports = {
  add(token, exp) {
    // exp is unix seconds
    cache.tokens.push({ token, exp });
    save();
  },
  has(token) {
    if (!token) return false;
    return cache.tokens.some((t) => t.token === token);
  },
};
