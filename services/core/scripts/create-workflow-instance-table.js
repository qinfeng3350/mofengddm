const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');

function loadEnvFromFile() {
  const envPath = path.resolve(__dirname, '../.env');
  if (!fs.existsSync(envPath)) return;

  const content = fs.readFileSync(envPath, 'utf8');
  content.split(/\r?\n/).forEach((line) => {
    const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
    if (!match) return;
    const key = match[1];
    let value = match[2];
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith('\'') && value.endsWith('\''))) {
      value = value.slice(1, -1);
    }
    if (!(key in process.env)) {
      process.env[key] = value;
    }
  });
}

loadEnvFromFile();

async function run() {
  const config = {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '3306', 10),
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'mofengddm',
  };

  console.log('连接数据库...');
  const conn = await mysql.createConnection(config);

  const sql = `
    CREATE TABLE IF NOT EXISTS workflow_instances (
      id BIGINT AUTO_INCREMENT PRIMARY KEY,
      tenant_id BIGINT NOT NULL,
      form_id VARCHAR(128) NOT NULL,
      record_id VARCHAR(128) NOT NULL,
      workflow_id VARCHAR(128) NOT NULL,
      status VARCHAR(32) NOT NULL DEFAULT 'running',
      current_node_id VARCHAR(128) NULL,
      definition JSON NOT NULL,
      tasks JSON NULL,
      history JSON NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_tenant(tenant_id),
      INDEX idx_form(form_id),
      INDEX idx_record(record_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `;

  console.log('创建 workflow_instances 表（如不存在）...');
  await conn.execute(sql);
  await conn.end();
  console.log('✅ 完成');
}

run().catch((e) => { console.error(e); process.exit(1); });
