/**
 * 清理指定租户的流程实例和待办任务
 * 使用方法: node scripts/cleanup-workflow-tasks.js <tenantId>
 */

const mysql = require('mysql2/promise');

// 数据库配置（与项目 env.example 保持一致）
const dbConfig = {
  host: process.env.DB_HOST || '39.106.142.253',
  port: parseInt(process.env.DB_PORT || '3306'),
  user: process.env.DB_USER || 'mofengddm',
  password: process.env.DB_PASSWORD || 'mofengddm',
  database: process.env.DB_NAME || 'mofengddm',
};

async function cleanup() {
  const tenantId = process.argv[2];
  if (!tenantId) {
    console.error('用法: node scripts/cleanup-workflow-tasks.js <tenantId>');
    process.exit(1);
  }

  let connection;
  try {
    connection = await mysql.createConnection(dbConfig);
    console.log('✅ 已连接数据库');

    // 统计当前租户的流程实例数量
    const [rows] = await connection.execute(
      'SELECT COUNT(*) AS cnt FROM workflow_instances WHERE tenant_id = ?',
      [tenantId],
    );
    const count = rows[0]?.cnt || 0;
    console.log(`租户 ${tenantId} 目前有 ${count} 条流程实例（含待办任务）。`);

    if (count === 0) {
      console.log('无需清理，退出。');
      process.exit(0);
    }

    // 直接删除该租户的所有流程实例（同时删除其中的 tasks / history 数据）
    const [delResult] = await connection.execute(
      'DELETE FROM workflow_instances WHERE tenant_id = ?',
      [tenantId],
    );

    console.log(`🧹 已删除租户 ${tenantId} 的流程实例记录:`, delResult.affectedRows);
    console.log('说明：这会清空该租户下的所有待办 / 流程记录，但不会影响应用和表单数据。');
  } catch (err) {
    console.error('❌ 清理失败:', err.message);
    process.exit(1);
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

cleanup();


