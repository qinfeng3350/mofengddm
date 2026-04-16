-- 创建记录评论表（查看页右侧评论面板）
CREATE TABLE IF NOT EXISTS `record_comments` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `tenant_id` bigint NOT NULL,
  `form_id` varchar(128) NOT NULL,
  `record_id` varchar(128) NOT NULL,
  `operator_id` varchar(128) NOT NULL,
  `operator_name` varchar(255) DEFAULT NULL,
  `operator_avatar` varchar(1024) DEFAULT NULL,
  `content` text NOT NULL,
  `created_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  `updated_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  PRIMARY KEY (`id`),
  KEY `idx_record_comments_tenant_form_record` (`tenant_id`,`form_id`,`record_id`),
  KEY `idx_record_comments_form_id` (`form_id`),
  KEY `idx_record_comments_record_id` (`record_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

