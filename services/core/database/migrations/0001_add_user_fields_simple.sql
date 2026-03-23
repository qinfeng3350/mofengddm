-- 添加部门表和用户表新字段
-- 执行时间：2026-01-05

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

-- ============================================
-- 1. 创建部门表（如果不存在）
-- ============================================
CREATE TABLE IF NOT EXISTS `departments` (
  `id` BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `tenant_id` BIGINT UNSIGNED NOT NULL,
  `name` VARCHAR(128) NOT NULL COMMENT '部门名称',
  `code` VARCHAR(128) NULL UNIQUE COMMENT '部门编码',
  `parent_id` BIGINT UNSIGNED NULL COMMENT '父部门ID',
  `description` TEXT NULL COMMENT '部门描述',
  `sort_order` INT NOT NULL DEFAULT 0 COMMENT '排序',
  `is_active` TINYINT(1) NOT NULL DEFAULT 1 COMMENT '是否启用',
  `metadata` TEXT NULL COMMENT '扩展元数据',
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX `idx_departments_tenant` (`tenant_id`),
  INDEX `idx_departments_parent` (`parent_id`),
  INDEX `idx_departments_code` (`code`),
  FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`),
  FOREIGN KEY (`parent_id`) REFERENCES `departments`(`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='部门表';

-- ============================================
-- 2. 添加用户表新字段（如果不存在）
-- ============================================

-- 添加头像字段
ALTER TABLE `users` 
ADD COLUMN IF NOT EXISTS `avatar` VARCHAR(255) NULL COMMENT '头像URL' AFTER `password_hash`;

-- 添加职位字段
ALTER TABLE `users` 
ADD COLUMN IF NOT EXISTS `position` VARCHAR(128) NULL COMMENT '职位' AFTER `avatar`;

-- 添加工号字段
ALTER TABLE `users` 
ADD COLUMN IF NOT EXISTS `jobNumber` VARCHAR(64) NULL COMMENT '工号' AFTER `position`;

-- 添加部门ID字段
ALTER TABLE `users` 
ADD COLUMN IF NOT EXISTS `department_id` BIGINT UNSIGNED NULL COMMENT '部门ID' AFTER `jobNumber`;

-- 添加部门索引（如果不存在）
CREATE INDEX IF NOT EXISTS `idx_users_department` ON `users` (`department_id`);

-- 添加外键约束（如果不存在）
-- 注意：MySQL 5.7+ 不支持 IF NOT EXISTS，需要先检查
SET FOREIGN_KEY_CHECKS = 1;

