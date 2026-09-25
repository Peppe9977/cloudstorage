-- Run this once against your MySQL server to set up the database.
-- Example: mysql -u root -p < db/init.sql

CREATE DATABASE IF NOT EXISTS cloudstorage
  CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

USE cloudstorage;

CREATE TABLE IF NOT EXISTS users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  username VARCHAR(64) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  -- Path relative to STORAGE_ROOT that this user is confined to (they can
  -- never see or write outside it). Use "/" to grant access to everything.
  root_folder VARCHAR(255) NOT NULL DEFAULT '/',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- If you're upgrading an existing database created before this column
-- existed, run this once instead of the CREATE TABLE above:
-- ALTER TABLE users ADD COLUMN root_folder VARCHAR(255) NOT NULL DEFAULT '/';

-- Dedicated app user (recommended over using root).
-- Change the password before running this, then update backend/.env to match.
CREATE USER IF NOT EXISTS 'cloudstorage'@'localhost' IDENTIFIED BY 'change_me';
GRANT ALL PRIVILEGES ON cloudstorage.* TO 'cloudstorage'@'localhost';
FLUSH PRIVILEGES;
