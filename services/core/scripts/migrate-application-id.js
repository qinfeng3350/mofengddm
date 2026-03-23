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
  const connection = await mysql.createConnection(config);
  console.log('数据库连接成功！');

  try {
    // 读取SQL文件
    const sqlPath = path.join(__dirname, '../database/migrations/0002_add_application_id_to_forms.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');

    console.log('开始执行迁移脚本...');
    
    // 执行SQL
    await connection.query(sql);
    
    console.log('✅ 迁移脚本执行成功！');
    console.log('');
    console.log('迁移内容：');
    console.log('1. 为每个租户创建了默认应用');
    console.log('2. 为form_definitions表添加了application_id字段');
    console.log('3. 将现有表单关联到默认应用');
    console.log('4. 设置了外键约束');
    
  } catch (error) {
    console.error('❌ 迁移失败:', error.message);
    if (error.sql) {
      console.error('SQL:', error.sql);
    }
    process.exit(1);
  } finally {
    await connection.end();
    console.log('数据库连接已关闭');
  }
}

runMigration().catch((error) => {
  console.error('执行失败:', error);
  process.exit(1);
});

