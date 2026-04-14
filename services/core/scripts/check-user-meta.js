const mysql = require('mysql2/promise');

async function main() {
  const host = process.env.DB_HOST || '39.106.142.253';
  const port = parseInt(process.env.DB_PORT || '3306', 10);
  const user = process.env.DB_USER || 'mofengddm';
  const password = process.env.DB_PASSWORD || 'mofengddm';
  const database = process.env.DB_NAME || 'mofengddm';

  const account = process.argv[2];
  if (!account) {
    console.error('Usage: node scripts/check-user-meta.js <account>');
    process.exit(1);
  }

  const conn = await mysql.createConnection({ host, port, user, password, database });
  const [rows] = await conn.query(
    'select id,name,account,department_id,metadata from users where account = ? limit 1',
    [account],
  );
  await conn.end();

  const r = rows[0];
  if (!r) {
    console.log(JSON.stringify({ found: false, account }, null, 2));
    return;
  }
  let meta = {};
  try {
    meta = typeof r.metadata === 'string' ? JSON.parse(r.metadata) : r.metadata || {};
  } catch {
    meta = { __raw: r.metadata };
  }
  console.log(
    JSON.stringify(
      {
        found: true,
        id: String(r.id),
        name: r.name,
        account: r.account,
        department_id: r.department_id ? String(r.department_id) : null,
        metadata: meta,
      },
      null,
      2,
    ),
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

