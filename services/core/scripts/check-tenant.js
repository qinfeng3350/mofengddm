/**
 * 检查租户和用户信息
 */

const mysql = require('mysql2/promise');

// 数据库配置（从环境变量或默认值）
const dbConfig = {
  host: process.env.DB_HOST || '39.106.142.253',
  port: parseInt(process.env.DB_PORT || '3306'),
  user: process.env.DB_USER || 'mofengddm',
  password: process.env.DB_PASSWORD || 'mofengddm',
  database: process.env.DB_NAME || 'mofengddm',
};

async function checkTenant() {
  let connection;
  try {
    connection = await mysql.createConnection(dbConfig);
    console.log('连接数据库成功\n');

    // 查询所有租户
    const [tenants] = await connection.execute('SELECT * FROM tenants ORDER BY id');
    console.log('📋 租户列表:');
    tenants.forEach((tenant) => {
      console.log(`  ID: ${tenant.id}, Code: ${tenant.code}, Name: ${tenant.name}`);
    });
    console.log('');

    // 查询所有用户（包括租户信息）
    const [users] = await connection.execute(`
      SELECT u.id, u.account, u.name, u.phone, u.avatar, u.tenant_id, t.name as tenant_name
      FROM users u
      LEFT JOIN tenants t ON u.tenant_id = t.id
      ORDER BY u.id
      LIMIT 20
    `);
    console.log('👥 用户列表（前20个）:');
    users.forEach((user) => {
      console.log(`  ID: ${user.id}, Account: ${user.account}, Name: ${user.name}, Phone: ${user.phone || 'N/A'}, Tenant: ${user.tenant_name || 'N/A'} (ID: ${user.tenant_id})`);
    });
    console.log('');

    // 查询部门信息
    const [departments] = await connection.execute(`
      SELECT d.id, d.name, d.code, d.tenant_id, t.name as tenant_name
      FROM departments d
      LEFT JOIN tenants t ON d.tenant_id = t.id
      ORDER BY d.id
      LIMIT 20
    `);
    console.log('🏢 部门列表（前20个）:');
    departments.forEach((dept) => {
      console.log(`  ID: ${dept.id}, Name: ${dept.name}, Code: ${dept.code || 'N/A'}, Tenant: ${dept.tenant_name || 'N/A'} (ID: ${dept.tenant_id})`);
    });

  } catch (error) {
    console.error('❌ 查询失败:', error.message);
    process.exit(1);
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

// 执行查询
checkTenant();

