-- 业务规则执行日志表：记录每次自动化规则的触发与执行结果
CREATE TABLE IF NOT EXISTS `business_rule_execution_logs` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `tenant_id` bigint NOT NULL,
  `application_id` bigint DEFAULT NULL,
  `rule_id` varchar(128) NOT NULL,
  `rule_name` varchar(255) DEFAULT NULL,
  `form_id` varchar(128) NOT NULL,
  `record_id` varchar(128) NOT NULL,
  `trigger_event` varchar(32) NOT NULL,
  `status` varchar(32) NOT NULL,
  `error_message` text DEFAULT NULL,
  `duration_ms` int DEFAULT NULL,
  `payload_snapshot` json DEFAULT NULL,
  `created_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  `updated_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  PRIMARY KEY (`id`),
  KEY `idx_bizrule_exec_tenant_rule` (`tenant_id`,`rule_id`),
  KEY `idx_bizrule_exec_form_record` (`tenant_id`,`form_id`,`record_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

