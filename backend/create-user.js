// Usage: node create-user.js <username> <password> [rootFolder]
// Creates (or updates the password/root folder of) a user in the users table.
// rootFolder is a path relative to STORAGE_ROOT the user will be confined
// to (e.g. "alice" → STORAGE_ROOT/alice). Use "/" (the default) to give the
// user access to the entire storage root.
require('dotenv').config();
const bcrypt = require('bcrypt');
const pool = require('./db/pool');

async function main() {
  const [username, password, rootFolder] = process.argv.slice(2);

  if (!username || !password) {
    console.error('Usage: node create-user.js <username> <password> [rootFolder]');
    process.exit(1);
  }

  const hash = await bcrypt.hash(password, 12);
  const root = rootFolder && rootFolder.trim() ? rootFolder.trim() : '/';

  await pool.query(
    `INSERT INTO users (username, password_hash, root_folder) VALUES (?, ?, ?)
     ON DUPLICATE KEY UPDATE password_hash = VALUES(password_hash), root_folder = VALUES(root_folder)`,
    [username, hash, root]
  );

  console.log(`User "${username}" created/updated with root folder "${root}".`);
  process.exit(0);
}

main().catch((err) => {
  console.error('Failed to create user:', err);
  process.exit(1);
});
