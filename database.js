import { DatabaseSync, constants } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';

export function seedDatabase(path) {
  const db = new DatabaseSync(path);
  db.exec(`CREATE TABLE IF NOT EXISTS customers (id INTEGER PRIMARY KEY, name TEXT NOT NULL, email TEXT, region TEXT, joined_at TEXT);
    CREATE TABLE IF NOT EXISTS products (id INTEGER PRIMARY KEY, name TEXT NOT NULL, category TEXT, price REAL);
    CREATE TABLE IF NOT EXISTS orders (id INTEGER PRIMARY KEY, customer_id INTEGER REFERENCES customers(id), order_date TEXT, status TEXT);
    CREATE TABLE IF NOT EXISTS order_items (id INTEGER PRIMARY KEY, order_id INTEGER REFERENCES orders(id), product_id INTEGER REFERENCES products(id), quantity INTEGER, unit_price REAL);`);
  if (!db.prepare('SELECT count(*) AS n FROM customers').get().n) {
    db.exec('BEGIN');
    const customers = [['Avery Chen','North'],['Jordan Patel','South'],['Morgan Lee','West'],['Sam Rivera','East'],['Taylor Kim','North'],['Casey Brooks','West'],['Riley Shah','South'],['Alex Martin','East'],['Jamie Wilson','North'],['Drew Garcia','West'],['Quinn Davis','South'],['Charlie Brown','East']];
    customers.forEach(([name, region], i) => db.prepare('INSERT INTO customers VALUES(?,?,?,?,?)').run(i+1,name,name.toLowerCase().replace(' ','.')+'@example.com',region,`2025-${String(i%9+1).padStart(2,'0')}-10`));
    const products = [['Studio headphones','Electronics',149],['Mechanical keyboard','Electronics',89],['Desk lamp','Home office',45],['Everyday backpack','Accessories',69],['Notebook set','Stationery',18],['USB-C hub','Electronics',59],['Standing desk','Home office',349],['Ceramic mug','Accessories',24]];
    products.forEach((p,i)=>db.prepare('INSERT INTO products VALUES(?,?,?,?)').run(i+1,...p));
    for(let i=1;i<=180;i++) {
      db.prepare('INSERT INTO orders VALUES(?,?,?,?)').run(i,(i*7)%12+1,`2026-${String((i-1)%10+1).padStart(2,'0')}-${String((i*3)%28+1).padStart(2,'0')}`,i%13===0?'cancelled':i%7===0?'pending':'completed');
      for(let j=0;j<1+i%3;j++){ const p=(i*3+j*5)%8; db.prepare('INSERT INTO order_items(order_id,product_id,quantity,unit_price) VALUES(?,?,?,?)').run(i,p+1,(i+j)%3+1,products[p][2]); }
    }
    db.exec('COMMIT');
  }
  db.close();
}

export function getSchema(path) {
  const db = new DatabaseSync(path,{readOnly:true});
  try { return db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name").all().map(({name})=>({name, columns:db.prepare(`PRAGMA table_info("${name.replaceAll('"','""')}")`).all(), rows:db.prepare(`SELECT count(*) AS n FROM "${name.replaceAll('"','""')}"`).get().n})); }
  finally { db.close(); }
}

export function executeQuery(path, sql) {
  if(typeof sql !== 'string' || sql.length>16000 || !/^\s*(SELECT|WITH)\b/i.test(sql)) throw new Error('Enter a SELECT query or a WITH query that reads data.');
  const db = new DatabaseSync(path,{readOnly:true});
  try {
    db.exec('PRAGMA query_only=ON');
    db.setAuthorizer((action,arg1,arg2)=>{
      if([constants.SQLITE_SELECT,constants.SQLITE_READ,constants.SQLITE_RECURSIVE].includes(action)) return constants.SQLITE_OK;
      if(action===constants.SQLITE_FUNCTION && !['load_extension','readfile','writefile'].includes(String(arg2).toLowerCase())) return constants.SQLITE_OK;
      return constants.SQLITE_DENY;
    });
    const start=performance.now();
    const stmt=db.prepare(sql);
    const columns=stmt.columns().map(c=>c.name);
    const rows=[]; let truncated=false;
    for(const row of stmt.iterate()){ if(rows.length===500){truncated=true;break;} rows.push(row); }
    return {columns,rows,truncated,duration:Math.round((performance.now()-start)*10)/10};
  } finally { db.close(); }
}

export function initialize() { mkdirSync(resolve('data'),{recursive:true}); const path=resolve('data/sales.sqlite'); seedDatabase(path); return path; }
