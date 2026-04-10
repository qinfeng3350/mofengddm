SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

CREATE TABLE IF NOT EXISTS `enterprise_logs` (
  `id` BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `tenant_id` BIGINT UNSIGNED NOT NULL COMMENT '租户ID',
  `category` VARCHAR(20) NOT NULL COMMENT 'platform/app/message',
  `subtype` VARCHAR(64) NULL COMMENT '子分类',
  `operator_id` VARCHAR(128) NULL COMMENT '操作人ID',
  `operator_name` VARCHAR(128) NULL COMMENT '操作人',
  `receiver` VARCHAR(128) NULL COMMENT '接收人（消息日志）',
  `operation_type` VARCHAR(128) NULL COMMENT '操作类型',
  `trigger_type` VARCHAR(128) NULL COMMENT '消息类型/触发类型',
  `error_type` VARCHAR(128) NULL COMMENT '错误类型',
  `related_app` VARCHAR(128) NULL COMMENT '所属应用',
  `related_object` VARCHAR(128) NULL COMMENT '操作对象',
  `content` VARCHAR(255) NULL COMMENT '消息内容',
  `detail` TEXT NULL COMMENT '操作详情',
  `ip` VARCHAR(64) NOT NULL DEFAULT '' COMMENT 'IP',
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '时间',
  INDEX `idx_ent_logs_tenant_category_time` (`tenant_id`, `category`, `created_at`),
  INDEX `idx_ent_logs_tenant_subtype` (`tenant_id`, `subtype`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='企业管理日志（平台/应用/消息）';

SET FOREIGN_KEY_CHECKS = 1;

