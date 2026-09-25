-- Runs once, the first time the database container starts with an empty data volume.
-- The database and the app user are created by the MARIADB_* variables in
-- docker-compose.yml, so only the table is needed here.
CREATE TABLE IF NOT EXISTS users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  username VARCHAR(64) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  root_folder VARCHAR(255) NOT NULL DEFAULT '/',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
