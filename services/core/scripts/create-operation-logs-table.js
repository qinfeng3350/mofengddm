const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');

async function createOperationLogsTable() {
  // 从环境变量或默认值读取数据库配置
  const config = {
    host: process.env.DB_HOST || '39.106.142.253',
    port: parseInt(process.env.DB_PORT || '3306', 10),
    user: process.env.DB_USER || 'mofengddm',
    password: process.env.DB_PASSWORD || 'mofengddm',
    database: process.env.DB_NAME || 'mofengddm',
    multipleStatements: true,
  };

  console.log('正在连接数据库...');
  console.log(`主机: ${config.host}:${config.port}`);
  console.log(`数据库: ${config.database}`);
  console.log(`用户: ${config.user}`);

  let connection;
  try {
    connection = await mysql.createConnection(config);
    console.log('✅ 数据库连接成功！\n');

    // 读取迁移文件
    const migrationPath = path.join(__dirname, '../database/migrations/0002_create_operation_logs.sql');
    const sql = fs.readFileSync(migrationPath, 'utf8');

    console.log('正在创建 operation_logs 表...');
    await connection.query(sql);
    console.log('✅ 表创建成功！\n');

    // 验证表是否创建成功
    console.log('正在验证表结构...');
    const [tables] = await connection.query(`
      SELECT TABLE_NAME 
      FROM INFORMATION_SCHEMA.TABLES 
      WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'operation_logs'
    `, [config.database]);

    if (tables.length > 0) {
      console.log('✅ operation_logs 表已创建！');
      
      // 显示表结构
      const [columns] = await connection.query(`
        SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE, COLUMN_DEFAULT
        FROM INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'operation_logs'
        ORDER BY ORDINAL_POSITION
      `, [config.database]);
      
      console.log('\n表结构：');
      columns.forEach(col => {
        console.log(`  - ${col.COLUMN_NAME}: ${col.DATA_TYPE} ${col.IS_NULLABLE === 'YES' ? 'NULL' : 'NOT NULL'}`);
      });
    } else {
      console.log('❌ operation_logs 表创建失败！');
    }

    await connection.end();
    console.log('\n✅ 完成！');
  } catch (error) {
    console.error('❌ 错误:', error.message);
    if (connection) {
      await connection.end();
    }
    process.exit(1);
  }
}

createOperationLogsTable();

