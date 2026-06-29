-- =====================================================================
--  ELBAKRI Hotel Rate Hub — MySQL / MariaDB Schema
--  Target: GoDaddy cPanel shared hosting (PHP 8 + MySQL 5.7+/MariaDB 10.3+)
--  Charset: utf8mb4 (full Arabic + emoji support)
--  Import order: 1) schema.sql   2) seed.sql
-- =====================================================================

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

-- ---------------------------------------------------------------------
-- users
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `users` (
  `id`            BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `email`         VARCHAR(190) NOT NULL,
  `full_name`     VARCHAR(190) NOT NULL,
  `password_hash` VARCHAR(255) NOT NULL,
  `role`          ENUM('admin','operations','sales','viewer') NOT NULL DEFAULT 'viewer',
  `is_active`     TINYINT(1) NOT NULL DEFAULT 1,
  `created_at`    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_users_email` (`email`),
  KEY `idx_users_role` (`role`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------
-- hotel_groups
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `hotel_groups` (
  `id`         BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `name`       VARCHAR(190) NOT NULL,
  `brand_name` VARCHAR(190) NULL,
  `region`     VARCHAR(120) NULL,
  `notes`      TEXT NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_groups_region` (`region`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------
-- hotels
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `hotels` (
  `id`                     BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `hotel_group_id`         BIGINT UNSIGNED NULL,
  `hotel_name`             VARCHAR(190) NOT NULL,
  `region`                 VARCHAR(120) NULL,
  `sub_region`             VARCHAR(120) NULL,
  `star_rating`            TINYINT UNSIGNED NULL,
  `address`                VARCHAR(255) NULL,
  `description`            TEXT NULL,
  `facilities`             TEXT NULL,
  `child_policy_default`   TEXT NULL,
  `transfer_notes_default` TEXT NULL,
  `status`                 ENUM('Active','Inactive') NOT NULL DEFAULT 'Active',
  `created_at`             TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`             TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_hotels_group` (`hotel_group_id`),
  KEY `idx_hotels_region` (`region`),
  KEY `idx_hotels_status` (`status`),
  CONSTRAINT `fk_hotels_group` FOREIGN KEY (`hotel_group_id`)
    REFERENCES `hotel_groups` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------
-- packages
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `packages` (
  `id`                    BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `package_name`          VARCHAR(190) NOT NULL,
  `package_type`          VARCHAR(80) NULL,
  `region`                VARCHAR(120) NULL,
  `hotel_group_id`        BIGINT UNSIGNED NULL,
  `description`           TEXT NULL,
  `default_meal_plan`     VARCHAR(20) NULL,
  `default_pricing_basis` VARCHAR(40) NULL,
  `status`                ENUM('Active','Inactive') NOT NULL DEFAULT 'Active',
  `created_at`            TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`            TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_packages_group` (`hotel_group_id`),
  KEY `idx_packages_region` (`region`),
  KEY `idx_packages_status` (`status`),
  CONSTRAINT `fk_packages_group` FOREIGN KEY (`hotel_group_id`)
    REFERENCES `hotel_groups` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------
-- package_hotels (many-to-many)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `package_hotels` (
  `id`         BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `package_id` BIGINT UNSIGNED NOT NULL,
  `hotel_id`   BIGINT UNSIGNED NOT NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_package_hotel` (`package_id`,`hotel_id`),
  KEY `idx_ph_hotel` (`hotel_id`),
  CONSTRAINT `fk_ph_package` FOREIGN KEY (`package_id`)
    REFERENCES `packages` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_ph_hotel` FOREIGN KEY (`hotel_id`)
    REFERENCES `hotels` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------
-- hotel_rates (the heart of the system)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `hotel_rates` (
  `id`                BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `hotel_id`          BIGINT UNSIGNED NOT NULL,
  `hotel_group_id`    BIGINT UNSIGNED NULL,
  `package_id`        BIGINT UNSIGNED NULL,
  -- denormalized snapshots for fast read / export
  `package_name`      VARCHAR(190) NULL,
  `hotel_name`        VARCHAR(190) NULL,
  `hotel_group`       VARCHAR(190) NULL,
  `region`            VARCHAR(120) NULL,
  `sub_region`        VARCHAR(120) NULL,
  `category`          VARCHAR(40)  NULL,           -- Hotel | Package | Select | Premium | Elite | Honeymoon | Trip | Transfer
  `offer_name`        VARCHAR(190) NULL,
  `season_name`       VARCHAR(190) NULL,
  `date_from`         DATE NULL,
  `date_to`           DATE NULL,
  `room_type`         VARCHAR(60)  NOT NULL DEFAULT 'Double', -- Single|Double|Triple|Custom...
  `meal_plan`         VARCHAR(10)  NOT NULL DEFAULT 'BB',     -- RO|BB|HB|FB|AI|SAI|UAI
  `pricing_basis`     VARCHAR(40)  NOT NULL DEFAULT 'per_person_per_night',
  `currency`          VARCHAR(3)   NOT NULL DEFAULT 'EGP',    -- EGP|USD|EUR|SAR
  `adult_price`       DECIMAL(12,2) NULL,
  `child_price`       DECIMAL(12,2) NULL,
  `child_age_from`    DECIMAL(4,1) NULL,
  `child_age_to`      DECIMAL(4,1) NULL,
  `nights`            SMALLINT UNSIGNED NULL,
  `days`              SMALLINT UNSIGNED NULL,
  `transfer_included` ENUM('Included','Optional','Not Included') NOT NULL DEFAULT 'Optional',
  `transfer_details`  TEXT NULL,
  `child_policy`      TEXT NULL,
  `cancellation_policy` TEXT NULL,
  `booking_notes`     TEXT NULL,
  `status`            ENUM('Draft','Ready','Archived') NOT NULL DEFAULT 'Draft',
  `source_type`       ENUM('manual','csv','xlsx') NOT NULL DEFAULT 'manual',
  `created_by`        BIGINT UNSIGNED NULL,
  `updated_by`        BIGINT UNSIGNED NULL,
  `created_at`        TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`        TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_rates_hotel` (`hotel_id`),
  KEY `idx_rates_package` (`package_id`),
  KEY `idx_rates_group` (`hotel_group_id`),
  KEY `idx_rates_status` (`status`),
  KEY `idx_rates_region` (`region`),
  KEY `idx_rates_dates` (`date_from`,`date_to`),
  KEY `idx_rates_scope` (`status`,`region`,`hotel_id`),
  CONSTRAINT `fk_rates_hotel` FOREIGN KEY (`hotel_id`)
    REFERENCES `hotels` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_rates_group` FOREIGN KEY (`hotel_group_id`)
    REFERENCES `hotel_groups` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `fk_rates_package` FOREIGN KEY (`package_id`)
    REFERENCES `packages` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------
-- quotes
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `quotes` (
  `id`           BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `quote_number` VARCHAR(40) NOT NULL,
  `client_name`  VARCHAR(190) NULL,
  `client_phone` VARCHAR(40) NULL,
  `client_notes` TEXT NULL,
  `status`       ENUM('draft','ready','sent','archived') NOT NULL DEFAULT 'draft',
  `created_by`   BIGINT UNSIGNED NULL,
  `created_at`   TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`   TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_quote_number` (`quote_number`),
  KEY `idx_quotes_creator` (`created_by`),
  KEY `idx_quotes_status` (`status`),
  CONSTRAINT `fk_quotes_user` FOREIGN KEY (`created_by`)
    REFERENCES `users` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------
-- quote_items
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `quote_items` (
  `id`            BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `quote_id`      BIGINT UNSIGNED NOT NULL,
  `hotel_rate_id` BIGINT UNSIGNED NOT NULL,
  `custom_note`   TEXT NULL,
  `sort_order`    INT NOT NULL DEFAULT 0,
  `created_at`    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_quote_rate` (`quote_id`,`hotel_rate_id`),
  KEY `idx_qi_rate` (`hotel_rate_id`),
  CONSTRAINT `fk_qi_quote` FOREIGN KEY (`quote_id`)
    REFERENCES `quotes` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_qi_rate` FOREIGN KEY (`hotel_rate_id`)
    REFERENCES `hotel_rates` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------
-- user_access_rules (scope-based permissions / RLS equivalent)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `user_access_rules` (
  `id`         BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `user_id`    BIGINT UNSIGNED NOT NULL,
  `scope_type` ENUM('all','region','hotel_group','hotel','package') NOT NULL DEFAULT 'all',
  `scope_id`   BIGINT UNSIGNED NULL,
  `scope_value` VARCHAR(190) NULL,  -- used when scope is matched by name (e.g. region)
  `can_view`   TINYINT(1) NOT NULL DEFAULT 1,
  `can_edit`   TINYINT(1) NOT NULL DEFAULT 0,
  `can_export` TINYINT(1) NOT NULL DEFAULT 0,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_uar_user` (`user_id`),
  KEY `idx_uar_scope` (`scope_type`,`scope_id`),
  CONSTRAINT `fk_uar_user` FOREIGN KEY (`user_id`)
    REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------
-- audit_logs
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `audit_logs` (
  `id`          BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `actor_id`    BIGINT UNSIGNED NULL,
  `actor_name`  VARCHAR(190) NULL,
  `action`      VARCHAR(40) NOT NULL,            -- create | update | delete | login | export ...
  `entity_type` VARCHAR(60) NOT NULL,            -- hotel | package | rate | quote ...
  `entity_id`   BIGINT UNSIGNED NULL,
  `old_data`    LONGTEXT NULL,                   -- JSON
  `new_data`    LONGTEXT NULL,                   -- JSON
  `created_at`  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_audit_actor` (`actor_id`),
  KEY `idx_audit_entity` (`entity_type`,`entity_id`),
  KEY `idx_audit_created` (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------
-- import_jobs
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `import_jobs` (
  `id`            BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `type`          ENUM('csv','xlsx') NOT NULL DEFAULT 'csv',
  `status`        ENUM('pending','processing','done','failed') NOT NULL DEFAULT 'pending',
  `rows_total`    INT NOT NULL DEFAULT 0,
  `rows_success`  INT NOT NULL DEFAULT 0,
  `rows_failed`   INT NOT NULL DEFAULT 0,
  `error_summary` LONGTEXT NULL,
  `created_by`    BIGINT UNSIGNED NULL,
  `created_at`    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_import_creator` (`created_by`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------
-- whatsapp_message_logs (optional)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `whatsapp_message_logs` (
  `id`         BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `phone`      VARCHAR(40) NULL,
  `direction`  ENUM('in','out') NOT NULL DEFAULT 'out',
  `message`    LONGTEXT NULL,
  `quote_id`   BIGINT UNSIGNED NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_wa_quote` (`quote_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

SET FOREIGN_KEY_CHECKS = 1;

-- =====================================================================
--  End of schema
-- =====================================================================
