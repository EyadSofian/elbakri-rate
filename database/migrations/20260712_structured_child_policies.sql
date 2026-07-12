-- Structured child policies for ELBAKRI Hotel Rate Hub
-- Safe to run more than once. Additive only; no existing data is modified.

SET NAMES utf8mb4;

CREATE TABLE IF NOT EXISTS `child_policies` (
  `id`            BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `hotel_id`      BIGINT UNSIGNED NOT NULL,
  `policy_code`   VARCHAR(80) NOT NULL,
  `policy_name`   VARCHAR(190) NOT NULL,
  `description`   TEXT NULL,
  `min_adults`    TINYINT UNSIGNED NOT NULL DEFAULT 1,
  `max_children`  TINYINT UNSIGNED NOT NULL DEFAULT 0,
  `status`        ENUM('Active','Inactive') NOT NULL DEFAULT 'Active',
  `created_by`    BIGINT UNSIGNED NULL,
  `updated_by`    BIGINT UNSIGNED NULL,
  `created_at`    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_child_policy_hotel_code` (`hotel_id`,`policy_code`),
  KEY `idx_child_policy_hotel` (`hotel_id`),
  KEY `idx_child_policy_status` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `child_policy_rules` (
  `id`                BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `child_policy_id`   BIGINT UNSIGNED NOT NULL,
  `child_number_from` TINYINT UNSIGNED NOT NULL DEFAULT 1,
  `child_number_to`   TINYINT UNSIGNED NOT NULL DEFAULT 1,
  `age_from`          DECIMAL(4,2) NOT NULL DEFAULT 0,
  `age_to`            DECIMAL(4,2) NOT NULL DEFAULT 11.99,
  `pricing_type`      ENUM('free','fixed','percent_adult','adult_rate','manual') NOT NULL DEFAULT 'manual',
  `value`             DECIMAL(12,2) NULL,
  `bed_type`          ENUM('sharing','extra_bed','any') NOT NULL DEFAULT 'any',
  `notes`             TEXT NULL,
  `sort_order`        INT NOT NULL DEFAULT 0,
  `created_at`        TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`        TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_child_rule_policy` (`child_policy_id`),
  KEY `idx_child_rule_sort` (`child_policy_id`,`sort_order`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

DROP PROCEDURE IF EXISTS elbakri_add_column_if_missing;
DELIMITER //
CREATE PROCEDURE elbakri_add_column_if_missing(
  IN p_table VARCHAR(64),
  IN p_column VARCHAR(64),
  IN p_definition TEXT
)
BEGIN
  IF NOT EXISTS (
    SELECT 1
      FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME = p_table
       AND COLUMN_NAME = p_column
  ) THEN
    SET @sql = CONCAT('ALTER TABLE `', p_table, '` ADD COLUMN ', p_definition);
    PREPARE stmt FROM @sql;
    EXECUTE stmt;
    DEALLOCATE PREPARE stmt;
  END IF;
END//
DELIMITER ;

CALL elbakri_add_column_if_missing('hotel_rates', 'child_policy_id', '`child_policy_id` BIGINT UNSIGNED NULL AFTER `child_age_to`');
CALL elbakri_add_column_if_missing('hotels', 'default_child_policy_id', '`default_child_policy_id` BIGINT UNSIGNED NULL AFTER `child_policy_default`');

DROP PROCEDURE IF EXISTS elbakri_add_index_if_missing;
DELIMITER //
CREATE PROCEDURE elbakri_add_index_if_missing(
  IN p_table VARCHAR(64),
  IN p_index VARCHAR(64),
  IN p_definition TEXT
)
BEGIN
  IF NOT EXISTS (
    SELECT 1
      FROM INFORMATION_SCHEMA.STATISTICS
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME = p_table
       AND INDEX_NAME = p_index
  ) THEN
    SET @sql = CONCAT('ALTER TABLE `', p_table, '` ADD ', p_definition);
    PREPARE stmt FROM @sql;
    EXECUTE stmt;
    DEALLOCATE PREPARE stmt;
  END IF;
END//
DELIMITER ;

CALL elbakri_add_index_if_missing('hotel_rates', 'idx_rates_child_policy', 'KEY `idx_rates_child_policy` (`child_policy_id`)');
CALL elbakri_add_index_if_missing('hotels', 'idx_hotels_default_child_policy', 'KEY `idx_hotels_default_child_policy` (`default_child_policy_id`)');

DROP PROCEDURE IF EXISTS elbakri_add_column_if_missing;
DROP PROCEDURE IF EXISTS elbakri_add_index_if_missing;
