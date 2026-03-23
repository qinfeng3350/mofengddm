const mysql = require('mysql2/promise');
const bcrypt = require('bcrypt');
try {
  require('dotenv').config();
} catch (e) {
  // dotenv 不存在时忽略
}

async function updateAdminPassword() {
  // 从环境变量读取配置，如果没有则使用 env.example 中的默认值
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || process.env.MYSQL_HOST || '39.106.142.253',
    port: parseInt(process.env.DB_PORT || process.env.MYSQL_PORT || '3306'),
    user: process.env.DB_USER || process.env.MYSQL_USER || 'mofengddm',
    password: process.env.DB_PASSWORD || process.env.MYSQL_PASSWORD || 'mofengddm',
    database: process.env.DB_NAME || process.env.MYSQL_DATABASE || 'mofengddm',
  });

  try {
    console.log('正在生成密码哈希...');
    const saltRounds = 10;
    const passwordHash = await bcrypt.hash('admin123', saltRounds);

    console.log('正在更新admin账号密码...');
    const [result] = await connection.query(
      `UPDATE users SET password_hash = ? WHERE account = 'admin'`,
      [passwordHash]
    );

    if (result.affectedRows === 0) {
      console.log('⚠️  admin账号不存在，正在创建...');
      
      // 获取默认租户ID
      const [tenants] = await connection.query(
        `SELECT id FROM tenants WHERE code = 'default' LIMIT 1`
      );

      if (tenants.length === 0) {
        console.error('❌ 默认租户不存在，请先运行数据库初始化脚本');
        process.exit(1);
      }

      const tenantId = tenants[0].id;

      // 创建admin账号
      await connection.query(
        `INSERT INTO users (tenant_id, account, name, email, password_hash, status) VALUES (?, 'admin', '超级管理员', 'admin@example.com', ?, 1)`,
        [tenantId, passwordHash]
      );

      console.log('✅ admin账号创建成功');
    } else {
      console.log('✅ admin账号密码更新成功');
    }

    console.log('\n📝 登录信息：');
    console.log('   账号: admin');
    console.log('   密码: admin123');
  } catch (error) {
    console.error('❌ 更新失败:', error.message);
    process.exit(1);
  } finally {
    await connection.end();
  }
}

updateAdminPassword();

