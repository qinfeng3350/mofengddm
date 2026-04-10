-- 登录日志表（企业管理-安全-登录日志）
SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

CREATE TABLE IF NOT EXISTS `login_logs` (
  `id` BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `tenant_id` BIGINT UNSIGNED NOT NULL COMMENT '租户ID',
  `user_id` BIGINT UNSIGNED NOT NULL COMMENT '用户ID',
  `user_name` VARCHAR(128) NULL COMMENT '登录人姓名（冗余）',
  `login_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '登录时间',
  `location` VARCHAR(255) NOT NULL DEFAULT '' COMMENT '登录地（本机/未知等）',
  `platform` VARCHAR(64) NOT NULL DEFAULT '' COMMENT '登录平台',
  `ip` VARCHAR(64) NOT NULL DEFAULT '' COMMENT 'IP',
  `user_agent` TEXT NULL COMMENT 'UA原文',
  INDEX `idx_login_logs_tenant_login_at` (`tenant_id`, `login_at`),
  INDEX `idx_login_logs_tenant_user` (`tenant_id`, `user_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='用户登录日志';

SET FOREIGN_KEY_CHECKS = 1;
