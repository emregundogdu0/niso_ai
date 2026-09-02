const { Client } = require('pg');

async function testPostgresReadOnly() {
  const client = new Client({
    host: 'localhost',
    port: 5432,
    database: 'management_ai',
    user: 'chatbot_reader',
    password: 'chatbot_read_2026_pass'
  });

  await client.connect();
  console.log('Connected to PostgreSQL as chatbot_reader.');

  const tests = [
    { name: 'SELECT 1 (Read-Only Test)', sql: 'SELECT 1 AS status;' },
    { name: 'CREATE TEMP TABLE', sql: 'CREATE TEMP TABLE temp_leak (id int);' },
    { name: 'INSERT Attempt', sql: "INSERT INTO attendance.employee (employee_no, full_name) VALUES ('E999', 'Hacker');" },
    { name: 'UPDATE Attempt', sql: "UPDATE attendance.daily_summary SET is_late = false WHERE employee_no = 'E001';" },
    { name: 'DELETE Attempt', sql: "DELETE FROM attendance.employee WHERE employee_no = 'E999';" },
    { name: 'DROP TABLE Attempt', sql: "DROP TABLE attendance.employee;" },
    { name: 'TRUNCATE Attempt', sql: "TRUNCATE attendance.event;" },
    { name: 'COPY / File Read Attempt', sql: "COPY attendance.employee TO '/tmp/leak.txt';" },
    { name: 'pg_sleep(5) Timeout Test', sql: "SELECT pg_sleep(5);" }
  ];

  const results = [];

  for (const t of tests) {
    const started = Date.now();
    try {
      const res = await client.query(t.sql);
      const elapsed = Date.now() - started;
      results.push({
        test: t.name,
        sql: t.sql,
        status: 'SUCCESS',
        rows: res.rowCount || (res.rows ? res.rows.length : 0),
        elapsedMs: elapsed
      });
    } catch (err) {
      const elapsed = Date.now() - started;
      results.push({
        test: t.name,
        sql: t.sql,
        status: 'BLOCKED_BY_POSTGRES',
        errorName: err.name,
        sqlState: err.code,
        errorMessage: err.message,
        elapsedMs: elapsed
      });
    }
  }

  await client.end();
  console.log(JSON.stringify(results, null, 2));
}

testPostgresReadOnly().catch(console.error);
