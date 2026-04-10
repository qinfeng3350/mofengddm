const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');

async function runMigration() {
  const config = {
    host: process.env.DB_HOST || '39.106.142.253',
    port: parseInt(process.env.DB_PORT || '3306', 10),
    user: process.env.DB_USER || 'mofengddm',
    password: process.env.DB_PASSWORD || 'mofengddm',
    database: process.env.DB_NAME || 'mofengddm',
    multipleStatements: true,
  };

  let connection;
  try {
    connection = await mysql.createConnection(config);
    const migrationPath = path.join(
      __dirname,
      '../database/migrations/0004_create_enterprise_logs.sql',
    );
    const sql = fs.readFileSync(migrationPath, 'utf8');
    await connection.query(sql);
    const [tables] = await connection.query(
      `
      SELECT TABLE_NAME
      FROM INFORMATION_SCHEMA.TABLES
      WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'enterprise_logs'
    `,
      [config.database],
    );
    if (tables.length > 0) {
      console.log('✅ enterprise_logs 表已存在/创建成功');
    } else {
      console.log('❌ enterprise_logs 表创建失败');
      process.exit(1);
    }
  } catch (error) {
    console.error('❌ enterprise_logs 迁移失败:', error.message);
    process.exit(1);
  } finally {
    if (connection) await connection.end();
  }
}

runMigration();

