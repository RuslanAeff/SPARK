'use strict';

// Fictional EUR household. Prices are illustrative, not current retailer offers.
// No personal backup values are read or copied. Node only; deterministic output.
const fs = require('node:fs');
const path = require('node:path');
const { createHash } = require('node:crypto');
const out = path.join(__dirname, '../artifacts/showcase');
const start = '2026-05-01', end = '2026-10-08';
const stamp = d => `${d}T12:00:00.000Z`;
const money = n => Math.round(n * 100) / 100;
const uuid = label => {
  const h = createHash('sha256').update(`spark-showcase-eur-v1:${label}`).digest('hex');
  return `${h.slice(0,8)}-${h.slice(8,12)}-4${h.slice(13,16)}-a${h.slice(17,20)}-${h.slice(20,32)}`;
};
let seed = 261008;
const random = () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296);
const choose = a => a[Math.floor(random() * a.length)];
const categories = [
  ['Housing', 'home', '#8B80C9'], ['Groceries', 'cart', '#45AD83'],
  ['Dining', 'restaurant', '#E8A14F'], ['Transport', 'bus', '#5A9DCE'],
  ['Bills', 'receipt', '#D3B24C'], ['Shopping', 'bag', '#C27BA0'],
  ['Health', 'medkit', '#CF7F77'], ['Leisure', 'film', '#9183CF'],
  ['Travel', 'airplane', '#58AFB8'],
].map(([name,icon,color]) => ({name,icon,color,parent_name:null}));
const vendorCategories = {
  'Apartment rent':'Housing', Lidl:'Groceries', ALDI:'Groceries', Carrefour:'Groceries',
  'Local bakery':'Dining', 'Neighbourhood cafe':'Dining', 'Lunch & Co.':'Dining',
  'Weekend trattoria':'Dining', 'City Transit':'Transport', Bolt:'Transport',
  'Shell':'Transport', 'Home Energy':'Bills', Vodafone:'Bills',
  IKEA:'Shopping', 'H&M':'Shopping', Decathlon:'Shopping', Zalando:'Shopping',
  dm:'Health', 'Local pharmacy':'Health', Netflix:'Leisure', Spotify:'Leisure',
  'City Cinema':'Leisure', 'Fitness Club':'Leisure', 'Museum Cafe':'Leisure',
  FlixBus:'Travel', 'Weekend Guesthouse':'Travel',
};
const data = {
  expenses:[], categories,
  vendors:Object.entries(vendorCategories).map(([name,default_category_name])=>({name,logo_uri:null,default_category_name})),
  budgets:[], dismissed_subscriptions:[], debts:[], debt_payments:[], extra_incomes:[],
  recurring_payment_reminders:[], canonical_products:[], product_aliases:[],
  budget_rollovers:[], container_deposit_vouchers:[], container_deposit_recoveries:[],
};
// Stable product identities make repeated baskets useful in Price Watch/history.
const catalog = [
  ['Whole milk 1 L',1.19], ['Sourdough bread 500 g',2.39], ['Free-range eggs 10 pack',2.89],
  ['Greek yoghurt 500 g',1.89], ['Oat drink 1 L',1.49], ['Bananas 1 kg',1.59],
  ['Apples 1 kg',2.19], ['Cherry tomatoes 250 g',1.69], ['Potatoes 2 kg',2.79],
  ['Baby spinach 200 g',1.39], ['Chicken breast 500 g',4.99], ['Salmon fillets 250 g',5.49],
  ['Pasta 500 g',0.99], ['Basmati rice 1 kg',2.29], ['Olive oil 500 ml',5.49],
  ['Ground coffee 250 g',3.49], ['Cheddar 250 g',2.49], ['Chickpeas 400 g',0.79],
  ['Dark chocolate 100 g',1.29], ['Frozen berries 300 g',2.69], ['Orange juice 1 L',1.79],
  ['Sparkling water 1.5 L',0.65], ['Oats 500 g',0.89], ['Peanut butter 350 g',2.39],
];
const products = new Map();
function product(name) {
  if (products.has(name)) return products.get(name);
  const key = name.toLowerCase();
  const p = {uid:uuid(name),canonical_name:name,canonical_key:key,measurement_unit:'piece',
    brand:null,variant:null,package_descriptor:null,created_at:stamp(start),updated_at:stamp(start)};
  products.set(name,p); data.canonical_products.push(p);
  data.product_aliases.push({canonical_product_uid:p.uid,normalized_alias:key,measurement_unit:'piece',
    source:'user',confidence:null,created_at:stamp(start)});
  return p;
}
let itemId = 1;
function expense(date,vendor,lines,note=null) {
  if(date>end) return;
  const category=vendorCategories[vendor];
  const items=lines.map(([name,price,quantity=1])=>({source_id:itemId++,name,turkish_name:null,user_label:null,
    quantity,measurement_unit:'piece',unit_price:money(price),total_price:money(price*quantity),
    category_name:category,canonical_product_uid:product(name).uid,financial_kind:'product',
    line_discount:0,list_line_total_before_discount:null}));
  data.expenses.push({source_id:data.expenses.length+1,created_at:stamp(date),date,
    total_amount:money(items.reduce((sum,i)=>sum+i.total_price,0)),currency:'EUR',note,receipt_uri:null,
    container_deposit_paid:0,container_voucher_used:0,vendor_name:vendor,category_name:category,items});
}
const date=(m,d)=>`2026-${String(m).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
for(let m=5;m<=10;m++) {
  const last=new Date(Date.UTC(2026,m,0)).getUTCDate();
  data.budgets.push({monthly_amount:2100,currency:'EUR',start_date:date(m,1).slice(0,7),
    period_start:date(m,1),period_end:date(m,last),cycle_start_day:1});
  for(const [day,vendor,title,amount] of [
    [1,'Apartment rent','Monthly rent',720], [2,'City Transit','Monthly transit pass',49],
    [3,'Home Energy','Electricity and heating',m===7?69.6:m===8?71.2:78.4],
    [5,'Vodafone','Home internet and mobile',34.99], [6,'Fitness Club','Monthly membership',29.9],
    [7,'Spotify','Music subscription',10.99], [12,'Netflix','Streaming subscription',12.99],
  ]) expense(date(m,day),vendor,[[title,amount]]);
  for(let d=1;d<=last;d++) {
    const day=date(m,d); if(day>end) break;
    const dow=new Date(`${day}T12:00:00Z`).getUTCDay();
    if(dow===2||dow===6) {
      const vendor=choose(['Lidl','Lidl','ALDI','Carrefour']);
      const indices=[0,1,2,5];
      while(indices.length<(dow===6?14:10)) {const i=Math.floor(random()*catalog.length);if(!indices.includes(i)) indices.push(i);}
      const lines=indices.map(i=>{
        const [name,base]=catalog[i];
        // Both rises and falls; same packaged products remain comparable.
        const trend=1+(m-5)*(i%3===0?0.009:i%3===1?-0.006:0.003);
        const price=money(base*trend*(vendor==='Carrefour'?1.06:vendor==='ALDI'?0.97:1)*(random()<0.12?0.9:1));
        return [name,price,i===0||i===5?2:1];
      });
      expense(day,vendor,lines);
    }
    if([1,3,5].includes(dow)&&random()<0.65) expense(day,'Neighbourhood cafe',[[choose(['Cappuccino','Flat white']),choose([3.2,3.5,3.8])]]);
    if(dow===4&&random()<0.8) expense(day,'Lunch & Co.',[['Lunch bowl',choose([10.9,11.5,12.4])]]);
    if(dow===0&&random()<0.6) expense(day,'Local bakery',[['Croissant',1.65,2],['Baguette',1.4]]);
    if([10,24].includes(d)) expense(day,'Weekend trattoria',[['Dinner for two',money(32+random()*17)]]);
  }
  for(const [d,v,title,amount] of [
    [4,'dm','Everyday care essentials',money(15+random()*12)],
    [15,'Shell','Fuel top-up',money(30+random()*15)],
    [18,'Local pharmacy','Pharmacy essentials',money(7+random()*12)],
    [21,'City Cinema','Cinema tickets',24], [26,'Bolt','Evening ride',money(9+random()*8)],
  ]) expense(date(m,d),v,[[title,amount]]);
}
for(const [day,v,title,amount] of [
 ['2026-05-16','H&M','Cotton shirts',34.98],['2026-05-27','IKEA','Desk lamp and storage',48.97],
 ['2026-06-13','Decathlon','Running shoes',59.99],['2026-06-20','FlixBus','Weekend return ticket',38.8],
 ['2026-06-20','Weekend Guesthouse','Two-night stay',138],['2026-06-21','Museum Cafe','Museum admission',16],
 ['2026-07-11','Zalando','Summer sandals',39.95],['2026-07-26','IKEA','Kitchen essentials',28.47],
 ['2026-08-15','FlixBus','Weekend return ticket',42.8],['2026-08-15','Weekend Guesthouse','Two-night stay',152],
 ['2026-08-16','Museum Cafe','Museum admission',18],['2026-08-22','Decathlon','Sportswear',32.99],
 ['2026-09-12','H&M','Autumn knitwear',49.99],['2026-09-26','IKEA','Home textiles',36.98],
 ['2026-10-03','Decathlon','Training essentials',24.99],
]) expense(day,v,[[title,amount]]);
for(const [i,d,source,amount] of [[1,'2026-06-25','Freelance design',140],[2,'2026-08-27','Second-hand sale',65],[3,'2026-09-24','Freelance translation',95]])
  data.extra_incomes.push({source_id:i,source,amount,currency:'EUR',date:d,note:null,created_at:stamp(d)});
for(const [i,d,name,amount,direction,due] of [[1,'2026-09-20','Alex (demo)',80,'lent','2026-10-20'],[2,'2026-08-14','Sam (demo)',120,'borrowed','2026-09-14']])
  data.debts.push({source_id:i,linked_expense_source_id:null,linked_expense_relation_omitted:false,direction,
    counterparty:name,amount,currency:'EUR',date:d,due_date:due,reminder_enabled:false,reminder_days_before:2,
    reminder_time:'10:00',note:null,created_at:stamp(d)});
for(const [i,debt,d,amount] of [[1,1,'2026-10-04',30],[2,2,'2026-09-10',120]])
  data.debt_payments.push({source_id:i,debt_source_id:debt,amount,date:d,created_at:stamp(d)});
for(const [v,title,amount,day,next] of [['Netflix','Streaming',12.99,12,'2026-10-12'],['Vodafone','Internet & mobile',34.99,5,'2026-11-05'],['Fitness Club','Gym membership',29.9,6,'2026-11-06'],['Spotify','Music',10.99,7,'2026-11-07']])
  data.recurring_payment_reminders.push({uid:uuid(`reminder:${v}`),title,vendor_name:v,expected_amount:amount,
    currency:'EUR',anchor_date:date(5,day),next_due_date:next,recurrence_unit:'month',recurrence_interval:1,
    reminder_days_before:2,reminder_time:'10:00',status:'active',source:'manual',note:null,
    created_at:stamp(start),updated_at:stamp(end)});
data.expenses.sort((a,b)=>a.date.localeCompare(b.date)||a.source_id-b.source_id);
const payload={version:6,app:'S.P.A.R.K.',exportedAt:stamp(end),range:{start,end},data};
fs.mkdirSync(out,{recursive:true});
fs.writeFileSync(path.join(out,'spark-showcase-europe_2026-05-01_2026-10-08.json'),JSON.stringify(payload,null,2)+'\n');
const months={};const totals={};
for(const e of data.expenses){const m=e.date.slice(0,7);months[m]=money((months[m]||0)+e.total_amount);totals[e.category_name]=money((totals[e.category_name]||0)+e.total_amount);}
console.log(JSON.stringify({transactions:data.expenses.length,items:itemId-1,products:products.size,vendors:data.vendors.length,months,categories:totals},null,2));
