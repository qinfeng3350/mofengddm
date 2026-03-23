const mysql = require('mysql2/promise');
const bcrypt = require('bcrypt');
try {
  require('dotenv').config();
} catch (e) {
  // dotenv 不存在时忽略
}

async function checkAdminUser() {
  // 从环境变量读取配置，如果没有则使用 env.example 中的默认值
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || process.env.MYSQL_HOST || '39.106.142.253',
    port: parseInt(process.env.DB_PORT || process.env.MYSQL_PORT || '3306'),
    user: process.env.DB_USER || process.env.MYSQL_USER || 'mofengddm',
    password: process.env.DB_PASSWORD || process.env.MYSQL_PASSWORD || 'mofengddm',
    database: process.env.DB_NAME || process.env.MYSQL_DATABASE || 'mofengddm',
  });

  try {
    console.log('🔍 正在检查 admin 用户状态...\n');

    // 检查 admin 用户是否存在
    const [users] = await connection.query(
      `SELECT id, account, name, email, password_hash, status, tenant_id, created_at 
       FROM users WHERE account = 'admin' LIMIT 1`
    );

    if (users.length === 0) {
      console.log('❌ admin 用户不存在！');
      console.log('\n💡 解决方案：运行以下命令创建/更新 admin 用户：');
      console.log('   cd services/core');
      console.log('   node scripts/update-admin-password.js');
      return;
    }

    const user = users[0];
    console.log('✅ admin 用户存在');
    console.log(`   ID: ${user.id}`);
    console.log(`   账号: ${user.account}`);
    console.log(`   姓名: ${user.name}`);
    console.log(`   邮箱: ${user.email}`);
    console.log(`   状态: ${user.status === 1 ? '✅ 启用' : '❌ 禁用'}`);
    console.log(`   租户ID: ${user.tenant_id}`);
    console.log(`   创建时间: ${user.created_at}`);

    // 检查密码是否正确
    console.log('\n🔐 正在验证密码...');
    const isPasswordValid = await bcrypt.compare('admin123', user.password_hash);
    
    if (isPasswordValid) {
      console.log('✅ 密码验证通过（admin123）');
    } else {
      console.log('❌ 密码验证失败！当前密码不是 admin123');
      console.log('\n💡 解决方案：运行以下命令重置密码：');
      console.log('   cd services/core');
      console.log('   node scripts/update-admin-password.js');
    }

    // 检查租户是否存在
    console.log('\n🏢 正在检查租户...');
    const [tenants] = await connection.query(
      `SELECT id, code, name FROM tenants WHERE id = ? LIMIT 1`,
      [user.tenant_id]
    );

    if (tenants.length === 0) {
      console.log('❌ 租户不存在！这可能导致登录问题。');
    } else {
      console.log(`✅ 租户存在: ${tenants[0].name} (${tenants[0].code})`);
    }

    // 总结
    console.log('\n📋 诊断总结：');
    if (user.status !== 1) {
      console.log('   ⚠️  用户状态为禁用，需要启用');
    }
    if (!isPasswordValid) {
      console.log('   ⚠️  密码不正确，需要重置');
    }
    if (user.status === 1 && isPasswordValid && tenants.length > 0) {
      console.log('   ✅ 所有检查通过，应该可以正常登录');
      console.log('   📝 登录信息：账号: admin, 密码: admin123');
    }

  } catch (error) {
    console.error('❌ 检查失败:', error.message);
    console.error('\n详细错误:', error);
  } finally {
    await connection.end();
  }
}

checkAdminUser();

