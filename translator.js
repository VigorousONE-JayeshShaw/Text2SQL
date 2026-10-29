export const examples = [
  'What is our revenue by month?', 'Who are our top 5 customers?',
  'Which products sell the most?', 'Compare revenue by region',
  'How many orders have each status?', 'Show customers with no orders'
];
const revenue = 'SUM(oi.quantity * oi.unit_price)';
const joins = 'FROM orders o\nJOIN order_items oi ON oi.order_id = o.id';
const completed = "o.status = 'completed'";
export function localTranslate(question) {
  const q=question.toLowerCase().trim();
  // Do not silently discard filters that the offline templates cannot express.
  if (/\b(last|since|before|after|between|yesterday|today|year|weekly|daily|where|excluding|only|electronics|accessories|stationery|pending orders|cancelled orders)\b|[<>=$]|\b20\d{2}\b/.test(q)) {
    throw new Error('Sample mode does not support those filters. Try a suggested question, edit the generated SQL, or configure OPENAI_API_KEY.');
  }
  const limit=Math.min(100,Number(q.match(/\b(?:top|first)\s+(\d+)\b/)?.[1]||5));
  if(/\b(month|monthly)\b/.test(q)) return {sql:`SELECT strftime('%Y-%m', o.order_date) AS month,\n       ROUND(${revenue}, 2) AS revenue\n${joins}\nWHERE ${completed}\nGROUP BY month\nORDER BY month;`,explanation:'Adds quantity × unit price for completed orders and groups the revenue by calendar month.'};
  if(/\b(region|regions)\b/.test(q)) return {sql:`SELECT c.region, ROUND(${revenue}, 2) AS revenue\n${joins}\nJOIN customers c ON c.id = o.customer_id\nWHERE ${completed}\nGROUP BY c.region\nORDER BY revenue DESC;`,explanation:'Joins customers with their completed orders, then totals revenue for each region.'};
  if(/(?:no|without|never).*order/.test(q)) return {sql:'SELECT c.id, c.name, c.email, c.region\nFROM customers c\nLEFT JOIN orders o ON o.customer_id = c.id\nWHERE o.id IS NULL;',explanation:'Finds customers who have no matching order, including pending or cancelled orders.'};
  if(/customer/.test(q)&&/top|most|highest|spend|best/.test(q)) return {sql:`SELECT c.name, c.region,\n       ROUND(${revenue}, 2) AS total_spent\n${joins}\nJOIN customers c ON c.id = o.customer_id\nWHERE ${completed}\nGROUP BY c.id, c.name, c.region\nORDER BY total_spent DESC\nLIMIT ${limit};`,explanation:`Ranks the top ${limit} customers by revenue from completed orders.`};
  if(/product|categor/.test(q)&&/sell|sold|top|most|popular|revenue|best/.test(q)) {const category=/categor/.test(q);return {sql:`SELECT p.${category?'category':'name'}, SUM(oi.quantity) AS units_sold,\n       ROUND(${revenue}, 2) AS revenue\n${joins}\nJOIN products p ON p.id = oi.product_id\nWHERE ${completed}\nGROUP BY p.${category?'category':'id, p.name'}\nORDER BY units_sold DESC\nLIMIT ${limit};`,explanation:`Ranks ${category?'categories':'products'} by units sold in completed orders and includes their revenue.`};}
  if(/status|pending|cancelled|canceled/.test(q)) return {sql:'SELECT status, COUNT(*) AS order_count\nFROM orders\nGROUP BY status\nORDER BY order_count DESC;',explanation:'Counts all orders in each status, including completed, pending and cancelled.'};
  if(/total.*revenue|revenue.*total/.test(q)) return {sql:`SELECT ROUND(${revenue}, 2) AS total_revenue\n${joins}\nWHERE ${completed};`,explanation:'Totals revenue from completed orders only.'};
  if(/\b(show|list|all|count|how many)\b/.test(q)) {
    const table=/customer/.test(q)?'customers':/product/.test(q)?'products':/order/.test(q)?'orders':null;
    if(table) return {sql:/count|how many/.test(q)?`SELECT COUNT(*) AS total FROM ${table};`:`SELECT * FROM ${table}\nLIMIT 100;`,explanation:`${/count|how many/.test(q)?'Counts':'Shows up to 100 rows from'} the ${table} table.`};
  }
  throw new Error('Sample mode could not translate that question. Try a suggested question, edit SQL directly, or configure OPENAI_API_KEY for broader questions.');
}
export async function translate(question,schema) {
  if(!process.env.OPENAI_API_KEY) return {...localTranslate(question),mode:'sample'};
  const response=await fetch('https://api.openai.com/v1/chat/completions',{
    method:'POST',signal:AbortSignal.timeout(30000),headers:{'Content-Type':'application/json',Authorization:`Bearer ${process.env.OPENAI_API_KEY}`},
    body:JSON.stringify({model:process.env.OPENAI_MODEL||'gpt-4.1-mini',response_format:{type:'json_object'},messages:[{role:'system',content:`Translate questions to SQLite SELECT statements. Return JSON with sql and explanation string fields. Never mutate data. Use only the supplied schema. Revenue means quantity * unit_price for completed orders. Dates use YYYY-MM-DD. If ambiguous or impossible return an error string field. Schema: ${JSON.stringify(schema)}`},{role:'user',content:question}]})
  });
  if(!response.ok) throw new Error(`AI service returned ${response.status}. Check the server API key and model configuration.`);
  const data=await response.json(); const answer=JSON.parse(data.choices?.[0]?.message?.content||'{}');
  if(answer.error) throw new Error(String(answer.error));
  if(typeof answer.sql!=='string'||typeof answer.explanation!=='string') throw new Error('AI returned an invalid response. Please try again.');
  return {...answer,mode:'ai'};
}
