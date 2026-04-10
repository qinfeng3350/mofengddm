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

  console.log('【login_logs 迁移】正在连接数据库...');
  console.log(`主机: ${config.host}:${config.port}`);
  console.log(`数据库: ${config.database}`);

  let connection;
  try {
    connection = await mysql.createConnection(config);
    console.log('✅ 数据库连接成功！\\n');

    const migrationPath = path.join(
      __dirname,
      '../database/migrations/0003_create_login_logs.sql',
    );
    const sql = fs.readFileSync(migrationPath, 'utf8');

    console.log('正在执行 0003_create_login_logs.sql ...');
    await connection.query(sql);
    console.log('✅ login_logs 表迁移执行成功！\\n');

    const [tables] = await connection.query(
      `
      SELECT TABLE_NAME 
      FROM INFORMATION_SCHEMA.TABLES 
      WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'login_logs'
    `,
      [config.database],
    );

    if (tables.length > 0) {
      console.log('✅ login_logs 表已存在/创建成功');
    } else {
      console.log('⚠️  login_logs 表仍未找到，请检查迁移脚本');
    }

    console.log('\\n🎉 登录日志表迁移完成！');
  } catch (error) {
    console.error('❌ login_logs 迁移失败:', error.message);
    if (error.sql) {
      console.error('SQL:', error.sql);
    }
    process.exit(1);
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

runMigration();

