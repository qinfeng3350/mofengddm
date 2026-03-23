const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');

async function runMigration() {
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
    const migrationPath = path.join(__dirname, '../database/migrations/0001_add_user_fields.sql');
    const sql = fs.readFileSync(migrationPath, 'utf8');

    console.log('正在执行迁移...');
    await connection.query(sql);
    console.log('✅ 迁移执行成功！\n');

    // 验证字段是否添加成功
    console.log('正在验证迁移结果...');
    const [columns] = await connection.query(`
      SELECT COLUMN_NAME 
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'users' 
      AND COLUMN_NAME IN ('avatar', 'position', 'jobNumber', 'department_id')
    `, [config.database]);

    console.log('✅ 用户表新字段：');
    columns.forEach(col => {
      console.log(`   - ${col.COLUMN_NAME}`);
    });

    // 检查 departments 表
    const [tables] = await connection.query(`
      SELECT TABLE_NAME 
      FROM INFORMATION_SCHEMA.TABLES 
      WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'departments'
    `, [config.database]);

    if (tables.length > 0) {
      console.log('\n✅ departments 表已创建');
    } else {
      console.log('\n⚠️  departments 表未创建，请检查迁移脚本');
    }

    console.log('\n🎉 迁移完成！');

  } catch (error) {
    console.error('❌ 迁移失败:', error.message);
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

