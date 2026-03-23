-- 创建操作记录表
-- 执行时间：2026-01-07

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

-- ============================================
-- 创建操作记录表
-- ============================================
CREATE TABLE IF NOT EXISTS `operation_logs` (
  `id` BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `tenant_id` BIGINT UNSIGNED NOT NULL COMMENT '租户ID',
  `form_id` VARCHAR(128) NOT NULL COMMENT '表单ID',
  `record_id` VARCHAR(128) NOT NULL COMMENT '记录ID',
  `operation_type` VARCHAR(50) NOT NULL COMMENT '操作类型：create/update/delete',
  `operator_id` VARCHAR(128) NOT NULL COMMENT '操作人ID',
  `operator_name` VARCHAR(255) NULL COMMENT '操作人姓名',
  `fieldChanges` TEXT NULL COMMENT '字段变更（JSON格式）',
  `description` TEXT NULL COMMENT '操作描述',
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  INDEX `idx_operation_logs_form_record` (`form_id`, `record_id`),
  INDEX `idx_operation_logs_tenant_form` (`tenant_id`, `form_id`),
  INDEX `idx_operation_logs_record` (`record_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='操作记录表';

SET FOREIGN_KEY_CHECKS = 1;

