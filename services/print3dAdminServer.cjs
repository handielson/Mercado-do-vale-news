'use strict';

// Administrative read models use the same isolated customer, order and receipt
// sources as the 3D checkout. They never fall back to Mercado do Vale customers.
function pagination(query = {}) {
  const integer = (value, fallback, max) => {
    if (value === undefined) return fallback;
    const number = Number(value);
    if (!Number.isInteger(number) || number < 1 || number > max) throw Object.assign(new Error('Paginação inválida.'), { statusCode:400 });
    return number;
  };
  if (query.search !== undefined && (typeof query.search !== 'string' || query.search.length > 120)) {
    throw Object.assign(new Error('Busca inválida.'), { statusCode:400 });
  }
  return { page:integer(query.page,1,10000),page_size:integer(query.page_size,25,100),search:(query.search || '').trim() };
}
function customer(row) {
  return { id:row.id,name:row.name,email:row.email,phone:row.phone,is_active:Boolean(Number(row.is_active)),
    email_verified_at:row.email_verified_at,phone_verified_at:row.phone_verified_at,created_at:row.created_at };
}
function order(row) {
  const total = Number(row.total), confirmed = Number(row.confirmed_cents || 0);
  return { id:row.id,order_number:row.public_number == null ? null : '3D-' + String(row.public_number),
    status:row.status,payment_status:row.payment_status,created_at:row.created_at,
    subtotal_cents:Number(row.subtotal),shipping_cents:Number(row.shipping_cost),total_cents:total,
    confirmed_cents:confirmed,outstanding_cents:Math.max(0,total-confirmed),
    customer:{id:row.print3d_customer_id,name:row.customer_name,email:row.customer_email,phone:row.customer_phone},
    payment_schedule:row.public_number == null ? null : {
      due_on_confirmation_cents:Number(row.due_on_confirmation_cents),due_before_shipping_cents:Number(row.due_before_shipping_cents),
      initial_payment_bps:Number(row.initial_payment_bps),shipping_payment_mode:row.shipping_payment_mode } };
}
function registerPrint3dAdminRoutes(app,{pool,getBearerAuthContext,customersEnabled=false,ordersEnabled=false}) {
  const admin = async (request,reply) => {
    reply.header('Cache-Control','no-store');
    const auth = await getBearerAuthContext(request);
    if (!auth?.isAdmin || !auth.userId) return reply.code(401).send({error:'Sessão de administrador necessária.'});
  };
  for (const kind of ['customers','orders']) {
    app.get('/admin/print3d/' + kind,{preHandler:admin},async (request,reply) => {
      try {
        const {page,page_size,search} = pagination(request.query);
        const enabled = kind === 'customers' ? customersEnabled === true : ordersEnabled === true;
        const result = {enabled,storefront:'loja_3d',items:[],total:0,page,page_size};
        if (!enabled) return result;
        const isCustomer = kind === 'customers';
        const from = isCustomer ? 'FROM print3d_customers c' : `FROM orders o
          LEFT JOIN print3d_customers c ON c.id=o.print3d_customer_id
          LEFT JOIN print3d_order_plans p ON p.order_id=o.id`;
        const where = [isCustomer ? '1=1' : "o.storefront='loja_3d' AND o.customer_id IS NULL"];
        const params = [];
        if (search) {
          const fields = isCustomer ? ['c.name','c.email','c.phone'] : ['c.name','c.email','c.phone',"CONCAT('3D-',p.public_number)"];
          where.push('(' + fields.map(field => `LOCATE(?,${field}) > 0`).join(' OR ') + ')');
          params.push(...fields.map(() => search));
        }
        const filtered = `${from} WHERE ${where.join(' AND ')}`;
        const [[count]] = await pool.query(`SELECT COUNT(*) AS total ${filtered}`,params);
        const projection = isCustomer ? 'c.id,c.name,c.email,c.phone,c.is_active,c.email_verified_at,c.phone_verified_at,c.created_at' : `o.id,o.status,o.payment_status,o.created_at,o.subtotal,o.shipping_cost,o.total,o.print3d_customer_id,
          c.name AS customer_name,c.email AS customer_email,c.phone AS customer_phone,p.public_number,
          p.due_on_confirmation_cents,p.due_before_shipping_cents,p.initial_payment_bps,p.shipping_payment_mode,
          (SELECT COALESCE(SUM(r.amount_cents),0) FROM print3d_order_payment_receipts r WHERE r.order_id=o.id AND r.status='confirmed') AS confirmed_cents`;
        const alias = isCustomer ? 'c' : 'o';
        const [rows] = await pool.query(`SELECT ${projection} ${filtered} ORDER BY ${alias}.created_at DESC,${alias}.id DESC LIMIT ? OFFSET ?`,[...params,page_size,(page-1)*page_size]);
        return {...result,total:Number(count.total),items:rows.map(isCustomer ? customer : order)};
      } catch (error) {
        if (error.statusCode === 400) return reply.code(400).send({error:error.message});
        request.log?.error({err:error},'print3d-admin-list');
        return reply.code(500).send({error:'Não foi possível consultar os registros da loja 3D.'});
      }
    });
  }
}
module.exports = {registerPrint3dAdminRoutes,pagination};
