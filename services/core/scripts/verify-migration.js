const mysql = require('mysql2/promise');

async function verifyMigration() {
  const config = {
    host: process.env.DB_HOST || '39.106.142.253',
    port: parseInt(process.env.DB_PORT || '3306', 10),
    user: process.env.DB_USER || 'mofengddm',
    password: process.env.DB_PASSWORD || 'mofengddm',
    database: process.env.DB_NAME || 'mofengddm',
  };

  console.log('正在连接数据库...');
  const connection = await mysql.createConnection(config);
  console.log('数据库连接成功！\n');

  try {
    // 检查application_id字段是否存在
    const [columns] = await connection.query(`
      SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE, COLUMN_DEFAULT
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = 'form_definitions'
        AND COLUMN_NAME = 'application_id'
    `);

    if (columns.length === 0) {
      console.log('❌ application_id 字段不存在！');
      console.log('需要重新执行迁移脚本。');
    } else {
      console.log('✅ application_id 字段存在：');
      console.log(columns[0]);
    }

    // 检查外键约束
    const [foreignKeys] = await connection.query(`
      SELECT CONSTRAINT_NAME, TABLE_NAME, COLUMN_NAME, REFERENCED_TABLE_NAME, REFERENCED_COLUMN_NAME
      FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = 'form_definitions'
        AND COLUMN_NAME = 'application_id'
        AND REFERENCED_TABLE_NAME = 'applications'
    `);

    if (foreignKeys.length === 0) {
      console.log('\n❌ 外键约束不存在！');
    } else {
      console.log('\n✅ 外键约束存在：');
      console.log(foreignKeys[0]);
    }

    // 检查默认应用
    const [defaultApps] = await connection.query(`
      SELECT id, tenant_id, name, code, status
      FROM applications
      WHERE code LIKE 'default-app-%'
    `);

    console.log(`\n✅ 找到 ${defaultApps.length} 个默认应用：`);
    defaultApps.forEach(app => {
      console.log(`  - ${app.name} (${app.code}) - 租户ID: ${app.tenant_id}`);
    });

    // 检查表单的application_id
    const [forms] = await connection.query(`
      SELECT COUNT(*) as total,
             SUM(CASE WHEN application_id IS NULL THEN 1 ELSE 0 END) as null_count
      FROM form_definitions
    `);

    console.log(`\n📊 表单统计：`);
    console.log(`  - 总表单数: ${forms[0].total}`);
    console.log(`  - application_id为NULL的表单数: ${forms[0].null_count}`);

  } catch (error) {
    console.error('❌ 验证失败:', error.message);
    process.exit(1);
  } finally {
    await connection.end();
    console.log('\n数据库连接已关闭');
  }
}

verifyMigration().catch((error) => {
  console.error('执行失败:', error);
  process.exit(1);
});

