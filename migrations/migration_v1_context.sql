-- Migration: Create autoresponder_ai_context table for Mercado do Vale AI Framework v1.0
-- Created: 2026-06-24

CREATE TABLE IF NOT EXISTS `autoresponder_ai_context` (
    `channel` VARCHAR(50) NOT NULL,
    `sender` VARCHAR(100) NOT NULL,
    `conversation_id` VARCHAR(36) NOT NULL,
    `framework_version` VARCHAR(10) NOT NULL DEFAULT '1.0.0',
    `schema_version` INT NOT NULL DEFAULT 1,
    `conversation_context` JSON NOT NULL,
    `order_context` JSON NOT NULL,
    `customer_context` JSON NOT NULL,
    `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (`channel`, `sender`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
