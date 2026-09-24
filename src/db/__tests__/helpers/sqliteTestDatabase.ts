import { spawn } from 'node:child_process';
import { createInterface } from 'node:readline';

/** Real in-memory SQLite, available on macOS and CI's Ubuntu without npm native binaries.
 * This validates SQL/transactions, not Expo's native connection lifecycle. */
export function sqliteTestDatabase() {
  const worker = spawn('python3', ['-u', '-c', `
import sqlite3,json,sys
db=sqlite3.connect(':memory:', isolation_level=None)
db.row_factory=sqlite3.Row
db.execute('PRAGMA foreign_keys=ON')
for line in sys.stdin:
 try:
  req=json.loads(line)
  if req['kind']=='script':
   db.executescript(req['sql']); result=None
  else:
   cur=db.execute(req['sql'],req.get('params',[]))
   if req['kind']=='all': result=[dict(row) for row in cur.fetchall()]
   elif req['kind']=='first':
    row=cur.fetchone(); result=dict(row) if row else None
   else: result={'changes':cur.rowcount,'lastInsertRowId':cur.lastrowid}
  print(json.dumps({'result':result}),flush=True)
 except Exception as e: print(json.dumps({'error':str(e)}),flush=True)
`], { stdio: ['pipe', 'pipe', 'pipe'] });
  const pending: Array<{ resolve: (value: any) => void; reject: (error: Error) => void }> = [];
  const lines = createInterface({ input: worker.stdout });
  lines.on('line', line => {
    const request = pending.shift();
    const message = JSON.parse(line);
    if (message.error) request?.reject(new Error(message.error)); else request?.resolve(message.result);
  });
  worker.on('error', error => { for (const request of pending.splice(0)) request.reject(error); });
  const command = (kind: string, sql: string, params: unknown[] = []): Promise<any> => new Promise((resolve, reject) => {
    pending.push({ resolve, reject }); worker.stdin.write(JSON.stringify({ kind, sql, params }) + '\n');
  });
  return {
    execAsync: (sql: string) => command('script', sql),
    getAllAsync: (sql: string, params: unknown[] = []) => command('all', sql, params),
    getFirstAsync: (sql: string, params: unknown[] = []) => command('first', sql, params),
    runAsync: (sql: string, params: unknown[] = []) => command('run', sql, params),
    withTransactionAsync: async (work: () => Promise<void>) => {
      await command('run', 'BEGIN');
      try { await work(); await command('run', 'COMMIT'); }
      catch (error) { await command('run', 'ROLLBACK'); throw error; }
    },
    close: () => new Promise<void>(resolve => { worker.once('close', () => { lines.close(); resolve(); }); worker.stdin.end(); }),
  };
}
