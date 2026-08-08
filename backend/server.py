from fastapi import FastAPI, APIRouter, Depends, HTTPException, status, Response
from fastapi.security import OAuth2PasswordBearer
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
import uuid
import jwt
from pathlib import Path
from pydantic import BaseModel, Field, EmailStr
from typing import List, Optional, Literal
from datetime import datetime, timedelta, timezone
import bcrypt

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

JWT_SECRET = os.environ.get('JWT_SECRET', 'lotus-erp-dev-secret-change-me')
JWT_ALG = 'HS256'
TOKEN_MINUTES = 60 * 24 * 7  # 7 days

oauth2 = OAuth2PasswordBearer(tokenUrl='/api/auth/login')

app = FastAPI(title='LotusERP')
api = APIRouter(prefix='/api')

# ----------------- Models -----------------
Role = Literal['Owner', 'Manager', 'Accountant', 'Sales', 'Warehouse']

class RegisterIn(BaseModel):
    email: EmailStr
    password: str = Field(min_length=6)
    name: str
    business_name: Optional[str] = None
    role: Role = 'Owner'

class LoginIn(BaseModel):
    email: EmailStr
    password: str

class ForgotIdIn(BaseModel):
    business_name: str

class ResetPasswordIn(BaseModel):
    email: EmailStr
    business_name: str
    new_password: str

class Token(BaseModel):
    access_token: str
    token_type: str = 'bearer'
    user: dict

class ProductIn(BaseModel):
    name: str
    sku: Optional[str] = None
    category: Optional[str] = 'General'
    brand: Optional[str] = None
    hsn: Optional[str] = None
    unit: Optional[str] = 'pcs'
    purchase_price: float = 0
    selling_price: float = 0
    gst_rate: float = 5
    stock: float = 0
    low_stock_alert: float = 5
    image_base64: Optional[str] = None
    color: Optional[str] = None
    material: Optional[str] = None
    warehouse: Optional[str] = 'Main'
    barcode: Optional[str] = None

class CustomerIn(BaseModel):
    name: str
    phone: Optional[str] = None
    email: Optional[str] = None
    gstin: Optional[str] = None
    address: Optional[str] = None
    party_type: Literal['customer', 'supplier'] = 'customer'
    opening_balance: float = 0

class InvoiceItem(BaseModel):
    product_id: str
    name: str
    quantity: float
    price: float
    gst_rate: float = 5
    discount: float = 0

class InvoiceIn(BaseModel):
    customer_id: Optional[str] = None
    customer_name: Optional[str] = 'Walk-in'
    items: List[InvoiceItem]
    payment_method: Literal['Cash', 'UPI', 'Card', 'Bank', 'Credit'] = 'Cash'
    amount_paid: float = 0
    notes: Optional[str] = None
    kind: Literal['sale', 'purchase'] = 'sale'

class ExpenseIn(BaseModel):
    category: str
    amount: float
    date: Optional[str] = None
    notes: Optional[str] = None
    payment_method: Literal['Cash', 'UPI', 'Card', 'Bank'] = 'Cash'

# ----------------- Auth Helpers -----------------
def hash_pw(p: str) -> str:
    password_bytes = p.encode('utf-8')
    salt = bcrypt.gensalt()
    hashed = bcrypt.hashpw(password_bytes, salt)
    return hashed.decode('utf-8')

def verify_pw(p: str, h: str) -> bool:
    try:
        password_bytes = p.encode('utf-8')
        hashed_bytes = h.encode('utf-8')
        return bcrypt.checkpw(password_bytes, hashed_bytes)
    except Exception:
        return False

def make_token(user: dict) -> str:
    payload = {
        'sub': user['id'],
        'email': user['email'],
        'role': user.get('role', 'Owner'),
        'exp': datetime.now(timezone.utc) + timedelta(minutes=TOKEN_MINUTES),
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALG)

async def get_current_user(token: str = Depends(oauth2)):
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALG])
        uid = payload.get('sub')
        if not uid:
            raise ValueError()
    except Exception:
        raise HTTPException(status_code=401, detail='Invalid token')
    user = await db.users.find_one({'id': uid}, {'_id': 0, 'password_hash': 0})
    if not user:
        raise HTTPException(status_code=401, detail='User not found')
    return user

def require_roles(allowed_roles: List[Role]):
    async def dependency(current_user: dict = Depends(get_current_user)):
        if current_user.get('role') not in allowed_roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Access denied. Required roles: {allowed_roles}"
            )
        return current_user
    return dependency

def clean(doc):
    if doc is None:
        return None
    doc.pop('_id', None)
    return doc

# ----------------- Auth Routes -----------------
@api.post('/auth/register', response_model=Token)
async def register(payload: RegisterIn):
    existing = await db.users.find_one({'email': payload.email.lower()})
    if existing:
        raise HTTPException(status_code=400, detail='Email already registered')
    user = {
        'id': str(uuid.uuid4()),
        'email': payload.email.lower(),
        'name': payload.name,
        'business_name': payload.business_name or 'My Business',
        'role': payload.role,
        'password_hash': hash_pw(payload.password),
        'created_at': datetime.now(timezone.utc).isoformat(),
    }
    await db.users.insert_one(user)
    safe = {k: v for k, v in user.items() if k not in ('_id', 'password_hash')}
    return {'access_token': make_token(safe), 'token_type': 'bearer', 'user': safe}

@api.post('/auth/login', response_model=Token)
async def login(payload: LoginIn):
    user = await db.users.find_one({'email': payload.email.lower()})
    if not user or not verify_pw(payload.password, user.get('password_hash', '')):
        raise HTTPException(status_code=401, detail='Invalid credentials')
    safe = {k: v for k, v in user.items() if k not in ('_id', 'password_hash')}
    return {'access_token': make_token(safe), 'token_type': 'bearer', 'user': safe}

@api.post('/auth/forgot-id')
async def forgot_id(payload: ForgotIdIn):
    users = await db.users.find({'business_name': {'$regex': f'^{payload.business_name.strip()}$', '$options': 'i'}}, {'_id': 0, 'email': 1, 'name': 1}).to_list(10)
    if not users:
        raise HTTPException(status_code=404, detail='No users found with this business name')
    return {'emails': [u['email'] for u in users]}

@api.post('/auth/reset-password')
async def reset_password(payload: ResetPasswordIn):
    user = await db.users.find_one({'email': payload.email.lower()})
    if not user:
        raise HTTPException(status_code=404, detail='User email not found')
    if user.get('business_name', '').strip().lower() != payload.business_name.strip().lower():
        raise HTTPException(status_code=400, detail='Business name does not match record')
    if len(payload.new_password) < 6:
        raise HTTPException(status_code=400, detail='Password must be at least 6 characters')
    hashed = hash_pw(payload.new_password)
    await db.users.update_one({'_id': user['_id']}, {'$set': {'password_hash': hashed}})
    return {'message': 'Password reset successful'}

@api.get('/auth/me')
async def me(user=Depends(get_current_user)):
    return user

# ----------------- Products -----------------
@api.get('/products')
async def list_products(q: Optional[str] = None, category: Optional[str] = None, user=Depends(get_current_user)):
    query = {}
    if q:
        query['$or'] = [{'name': {'$regex': q, '$options': 'i'}}, {'sku': {'$regex': q, '$options': 'i'}}]
    if category and category != 'All':
        query['category'] = category
    cursor = db.products.find(query, {'_id': 0}).sort('name', 1)
    return await cursor.to_list(500)

@api.get('/products/categories')
async def product_categories(user=Depends(get_current_user)):
    cats = await db.products.distinct('category')
    return sorted([c for c in cats if c]) or ['General']

@api.post('/products')
async def create_product(payload: ProductIn, user=Depends(require_roles(['Owner', 'Manager']))):
    doc = payload.dict()
    doc['id'] = str(uuid.uuid4())
    if not doc.get('sku'):
        doc['sku'] = 'SKU-' + doc['id'][:6].upper()
    doc['created_at'] = datetime.now(timezone.utc).isoformat()
    await db.products.insert_one(doc)
    return clean(doc)

@api.put('/products/{pid}')
async def update_product(pid: str, payload: ProductIn, user=Depends(require_roles(['Owner', 'Manager']))):
    res = await db.products.find_one_and_update({'id': pid}, {'$set': payload.dict()})
    if not res:
        raise HTTPException(404, 'Not found')
    doc = await db.products.find_one({'id': pid}, {'_id': 0})
    return doc

@api.delete('/products/{pid}')
async def delete_product(pid: str, user=Depends(require_roles(['Owner', 'Manager']))):
    await db.products.delete_one({'id': pid})
    return {'ok': True}

# ----------------- Parties (Customers/Suppliers) -----------------
@api.get('/parties')
async def list_parties(party_type: Optional[str] = None, q: Optional[str] = None, user=Depends(get_current_user)):
    query = {}
    if party_type:
        query['party_type'] = party_type
    if q:
        query['$or'] = [{'name': {'$regex': q, '$options': 'i'}}, {'phone': {'$regex': q, '$options': 'i'}}]
    cursor = db.parties.find(query, {'_id': 0}).sort('name', 1)
    parties = await cursor.to_list(500)
    # compute outstanding = opening_balance + sum(unpaid invoices)
    for p in parties:
        agg = await db.invoices.aggregate([
            {'$match': {'customer_id': p['id']}},
            {'$group': {'_id': None, 'total': {'$sum': '$total'}, 'paid': {'$sum': '$amount_paid'}}}
        ]).to_list(1)
        due = 0
        if agg:
            due = (agg[0].get('total', 0) or 0) - (agg[0].get('paid', 0) or 0)
        p['outstanding'] = round((p.get('opening_balance', 0) or 0) + due, 2)
    return parties

@api.post('/parties')
async def create_party(payload: CustomerIn, user=Depends(require_roles(['Owner', 'Manager', 'Accountant']))):
    doc = payload.dict()
    doc['id'] = str(uuid.uuid4())
    doc['created_at'] = datetime.now(timezone.utc).isoformat()
    await db.parties.insert_one(doc)
    return clean(doc)

@api.put('/parties/{pid}')
async def update_party(pid: str, payload: CustomerIn, user=Depends(require_roles(['Owner', 'Manager', 'Accountant']))):
    await db.parties.find_one_and_update({'id': pid}, {'$set': payload.dict()})
    doc = await db.parties.find_one({'id': pid}, {'_id': 0})
    if not doc:
        raise HTTPException(404, 'Not found')
    return doc

@api.delete('/parties/{pid}')
async def delete_party(pid: str, user=Depends(require_roles(['Owner', 'Manager']))):
    await db.parties.delete_one({'id': pid})
    return {'ok': True}

# ----------------- Invoices -----------------
def compute_invoice_totals(items: List[dict]):
    subtotal = 0
    tax = 0
    for it in items:
        line = (it['price'] * it['quantity']) - (it.get('discount', 0) or 0)
        subtotal += line
        tax += line * (it.get('gst_rate', 0) or 0) / 100.0
    total = subtotal + tax
    return round(subtotal, 2), round(tax, 2), round(total, 2)

async def next_invoice_number(kind: str) -> str:
    prefix = 'INV' if kind == 'sale' else 'PUR'
    count = await db.invoices.count_documents({'kind': kind})
    return f"{prefix}-{(count + 1):05d}"

@api.post('/invoices')
async def create_invoice(payload: InvoiceIn, user=Depends(require_roles(['Owner', 'Manager', 'Sales', 'Accountant']))):
    items = [i.dict() for i in payload.items]
    if not items:
        raise HTTPException(400, 'No items')
    
    # Stock sufficiency check for sales
    if payload.kind == 'sale':
        for it in items:
            p = await db.products.find_one({'id': it['product_id']})
            if not p:
                raise HTTPException(400, f"Product {it['name']} not found in inventory")
            if p.get('stock', 0) < it['quantity']:
                raise HTTPException(400, f"Insufficient stock for {it['name']}. Available: {p.get('stock', 0)}, Requested: {it['quantity']}")

    subtotal, tax, total = compute_invoice_totals(items)
    inv = {
        'id': str(uuid.uuid4()),
        'invoice_number': await next_invoice_number(payload.kind),
        'kind': payload.kind,
        'customer_id': payload.customer_id,
        'customer_name': payload.customer_name or 'Walk-in',
        'items': items,
        'subtotal': subtotal,
        'tax': tax,
        'total': total,
        'amount_paid': payload.amount_paid,
        'balance_due': round(total - payload.amount_paid, 2),
        'payment_method': payload.payment_method,
        'notes': payload.notes,
        'created_at': datetime.now(timezone.utc).isoformat(),
        'created_by': user['id'],
    }
    await db.invoices.insert_one(inv)
    # update stock
    stock_delta = -1 if payload.kind == 'sale' else 1
    for it in items:
        await db.products.update_one({'id': it['product_id']}, {'$inc': {'stock': stock_delta * it['quantity']}})
    return clean(inv)

@api.get('/invoices')
async def list_invoices(kind: Optional[str] = None, limit: int = 100, user=Depends(get_current_user)):
    q = {}
    if kind:
        q['kind'] = kind
    cursor = db.invoices.find(q, {'_id': 0}).sort('created_at', -1).limit(limit)
    return await cursor.to_list(limit)

@api.get('/invoices/{iid}')
async def get_invoice(iid: str, user=Depends(get_current_user)):
    doc = await db.invoices.find_one({'id': iid}, {'_id': 0})
    if not doc:
        raise HTTPException(404, 'Not found')
    return doc

# ----------------- Expenses -----------------
@api.get('/expenses')
async def list_expenses(user=Depends(get_current_user)):
    cursor = db.expenses.find({}, {'_id': 0}).sort('created_at', -1).limit(200)
    return await cursor.to_list(200)

@api.post('/expenses')
async def create_expense(payload: ExpenseIn, user=Depends(require_roles(['Owner', 'Manager', 'Accountant']))):
    doc = payload.dict()
    doc['id'] = str(uuid.uuid4())
    doc['created_at'] = datetime.now(timezone.utc).isoformat()
    if not doc.get('date'):
        doc['date'] = doc['created_at'][:10]
    await db.expenses.insert_one(doc)
    return clean(doc)

@api.delete('/expenses/{eid}')
async def delete_expense(eid: str, user=Depends(require_roles(['Owner', 'Manager']))):
    await db.expenses.delete_one({'id': eid})
    return {'ok': True}

# ----------------- Dashboard & Reports -----------------
@api.get('/dashboard')
async def dashboard(user=Depends(require_roles(['Owner', 'Manager', 'Accountant']))):
    today = datetime.now(timezone.utc).date().isoformat()
    month_prefix = today[:7]

    # Sales today
    sales_today_cur = db.invoices.find({'kind': 'sale', 'created_at': {'$gte': today}}, {'_id': 0})
    sales_today = await sales_today_cur.to_list(1000)
    today_sales = sum(s.get('total', 0) for s in sales_today)

    # Month sales
    month_sales_cur = db.invoices.find({'kind': 'sale', 'created_at': {'$regex': f'^{month_prefix}'}}, {'_id': 0})
    month_sales = await month_sales_cur.to_list(5000)
    monthly_sales = sum(s.get('total', 0) for s in month_sales)

    # Month purchase
    month_purchase_cur = db.invoices.find({'kind': 'purchase', 'created_at': {'$regex': f'^{month_prefix}'}}, {'_id': 0})
    month_purchase = await month_purchase_cur.to_list(5000)
    monthly_purchase = sum(p.get('total', 0) for p in month_purchase)

    # Expenses today & month
    exp_today_cur = db.expenses.find({'created_at': {'$gte': today}}, {'_id': 0})
    exp_today = await exp_today_cur.to_list(500)
    today_expense = sum(e.get('amount', 0) for e in exp_today)

    month_exp_cur = db.expenses.find({'created_at': {'$regex': f'^{month_prefix}'}}, {'_id': 0})
    month_exp = await month_exp_cur.to_list(5000)
    monthly_expense = sum(e.get('amount', 0) for e in month_exp)

    # Inventory value & low stock
    products = await db.products.find({}, {'_id': 0}).to_list(5000)
    inventory_value = sum((p.get('purchase_price', 0) or 0) * (p.get('stock', 0) or 0) for p in products)
    low_stock = [p for p in products if (p.get('stock', 0) or 0) <= (p.get('low_stock_alert', 0) or 0)]

    # Pending receivables
    all_sale_inv = await db.invoices.find({'kind': 'sale'}, {'_id': 0}).to_list(10000)
    pending_receivable = sum(i.get('balance_due', 0) for i in all_sale_inv)

    # Today profit rough (sales - expense - purchase cost of items today)
    today_profit = today_sales - today_expense

    # Top products (this month by qty sold)
    top_products = {}
    for s in month_sales:
        for it in s.get('items', []):
            key = it.get('name', 'Unknown')
            top_products[key] = top_products.get(key, 0) + it.get('quantity', 0)
    top_products_list = sorted(
        [{'name': k, 'qty': v} for k, v in top_products.items()],
        key=lambda x: x['qty'], reverse=True
    )[:5]

    # 7-day sales trend
    from collections import OrderedDict
    trend = OrderedDict()
    now = datetime.now(timezone.utc).date()
    for i in range(6, -1, -1):
        d = (now - timedelta(days=i)).isoformat()
        trend[d] = 0
    recent_cur = db.invoices.find(
        {'kind': 'sale', 'created_at': {'$gte': (now - timedelta(days=6)).isoformat()}},
        {'_id': 0, 'created_at': 1, 'total': 1}
    )
    recent = await recent_cur.to_list(5000)
    for s in recent:
        d = s.get('created_at', '')[:10]
        if d in trend:
            trend[d] += s.get('total', 0)

    recent_invoices = await db.invoices.find({}, {'_id': 0}).sort('created_at', -1).limit(5).to_list(5)

    # Business health score (simple heuristic 0-100)
    score = 60
    if monthly_sales > 0:
        score += 15
    if monthly_sales > monthly_expense + monthly_purchase:
        score += 15
    if len(low_stock) == 0:
        score += 10
    score = min(100, score)

    return {
        'today_sales': round(today_sales, 2),
        'today_expense': round(today_expense, 2),
        'today_profit': round(today_profit, 2),
        'monthly_sales': round(monthly_sales, 2),
        'monthly_purchase': round(monthly_purchase, 2),
        'monthly_expense': round(monthly_expense, 2),
        'monthly_profit': round(monthly_sales - monthly_expense - monthly_purchase, 2),
        'inventory_value': round(inventory_value, 2),
        'low_stock_count': len(low_stock),
        'pending_receivable': round(pending_receivable, 2),
        'total_products': len(products),
        'top_products': top_products_list,
        'sales_trend': [{'date': k, 'amount': round(v, 2)} for k, v in trend.items()],
        'recent_invoices': recent_invoices,
        'business_health': score,
    }

@api.get('/reports/gst')
async def gst_report(user=Depends(require_roles(['Owner', 'Accountant']))):
    invoices = await db.invoices.find({'kind': 'sale'}, {'_id': 0}).to_list(10000)
    rate_summary = {}
    total_taxable = 0
    total_tax = 0
    for inv in invoices:
        for it in inv.get('items', []):
            rate = it.get('gst_rate', 0)
            line = (it['price'] * it['quantity']) - (it.get('discount', 0) or 0)
            tax = line * rate / 100
            key = f'{rate}%'
            if key not in rate_summary:
                rate_summary[key] = {'rate': rate, 'taxable': 0, 'cgst': 0, 'sgst': 0, 'total_tax': 0}
            rate_summary[key]['taxable'] += line
            rate_summary[key]['cgst'] += tax / 2
            rate_summary[key]['sgst'] += tax / 2
            rate_summary[key]['total_tax'] += tax
            total_taxable += line
            total_tax += tax
    for k in rate_summary:
        for f in ['taxable', 'cgst', 'sgst', 'total_tax']:
            rate_summary[k][f] = round(rate_summary[k][f], 2)
    return {
        'summary': list(rate_summary.values()),
        'total_taxable': round(total_taxable, 2),
        'total_tax': round(total_tax, 2),
        'invoice_count': len(invoices),
    }

@api.get('/reports/gst/export')
async def export_gst_report(user=Depends(require_roles(['Owner', 'Accountant']))):
    import io
    import csv
    invoices = await db.invoices.find({'kind': 'sale'}, {'_id': 0}).to_list(10000)
    rate_summary = {}
    total_taxable = 0
    total_tax = 0
    for inv in invoices:
        for it in inv.get('items', []):
            rate = it.get('gst_rate', 0)
            line = (it['price'] * it['quantity']) - (it.get('discount', 0) or 0)
            tax = line * rate / 100
            key = f'{rate}%'
            if key not in rate_summary:
                rate_summary[key] = {'rate': rate, 'taxable': 0, 'cgst': 0, 'sgst': 0, 'total_tax': 0}
            rate_summary[key]['taxable'] += line
            rate_summary[key]['cgst'] += tax / 2
            rate_summary[key]['sgst'] += tax / 2
            rate_summary[key]['total_tax'] += tax
            total_taxable += line
            total_tax += tax

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(['GST Rate', 'Taxable Value (INR)', 'CGST (INR)', 'SGST (INR)', 'Total GST Collected (INR)'])
    for k in sorted(rate_summary.keys()):
        r = rate_summary[k]
        writer.writerow([
            f"{r['rate']}%",
            f"{r['taxable']:.2f}",
            f"{r['cgst']:.2f}",
            f"{r['sgst']:.2f}",
            f"{r['total_tax']:.2f}"
        ])
    writer.writerow([
        'Total',
        f"{total_taxable:.2f}",
        f"{(total_tax / 2):.2f}",
        f"{(total_tax / 2):.2f}",
        f"{total_tax:.2f}"
    ])
    
    return Response(
        content=output.getvalue(),
        media_type='text/csv',
        headers={
            'Content-Disposition': 'attachment; filename=gst_report.csv',
            'Access-Control-Expose-Headers': 'Content-Disposition'
        }
    )

@api.get('/reports/sales-register')
async def sales_register(user=Depends(require_roles(['Owner', 'Manager', 'Accountant']))):
    invoices = await db.invoices.find({'kind': 'sale'}, {'_id': 0}).sort('created_at', -1).to_list(2000)
    return invoices

@api.get('/reports/sales-register/export')
async def export_sales_register(user=Depends(require_roles(['Owner', 'Manager', 'Accountant']))):
    import io
    import csv
    invoices = await db.invoices.find({'kind': 'sale'}, {'_id': 0}).sort('created_at', -1).to_list(10000)
    
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(['Invoice Number', 'Date', 'Customer Name', 'Subtotal (INR)', 'GST Collected (INR)', 'Total Amount (INR)', 'Payment Method', 'Balance Due (INR)'])
    
    for inv in invoices:
        writer.writerow([
            inv.get('invoice_number', ''),
            inv.get('created_at', '')[:10],
            inv.get('customer_name', 'Walk-in'),
            f"{inv.get('subtotal', 0):.2f}",
            f"{inv.get('tax', 0):.2f}",
            f"{inv.get('total', 0):.2f}",
            inv.get('payment_method', 'Cash'),
            f"{inv.get('balance_due', 0):.2f}"
        ])
        
    return Response(
        content=output.getvalue(),
        media_type='text/csv',
        headers={
            'Content-Disposition': 'attachment; filename=sales_register.csv',
            'Access-Control-Expose-Headers': 'Content-Disposition'
        }
    )

@api.get('/reports/pnl')
async def pnl_report(user=Depends(require_roles(['Owner', 'Accountant']))):
    sales = await db.invoices.find({'kind': 'sale'}, {'_id': 0}).to_list(10000)
    purchases = await db.invoices.find({'kind': 'purchase'}, {'_id': 0}).to_list(10000)
    expenses = await db.expenses.find({}, {'_id': 0}).to_list(10000)

    total_sales = sum(s.get('total', 0) for s in sales)
    total_purchases = sum(p.get('total', 0) for p in purchases)
    total_expenses = sum(e.get('amount', 0) for e in expenses)

    exp_by_cat = {}
    for e in expenses:
        cat = e.get('category', 'Other')
        exp_by_cat[cat] = exp_by_cat.get(cat, 0) + e.get('amount', 0)

    return {
        'total_sales': round(total_sales, 2),
        'total_purchases': round(total_purchases, 2),
        'total_expenses': round(total_expenses, 2),
        'gross_profit': round(total_sales - total_purchases, 2),
        'net_profit': round(total_sales - total_purchases - total_expenses, 2),
        'expenses_by_category': [{'category': k, 'amount': round(v, 2)} for k, v in sorted(exp_by_cat.items(), key=lambda x: -x[1])],
    }

@api.get('/reports/pnl/export')
async def export_pnl_report(user=Depends(require_roles(['Owner', 'Accountant']))):
    import io
    import csv
    sales = await db.invoices.find({'kind': 'sale'}, {'_id': 0}).to_list(10000)
    purchases = await db.invoices.find({'kind': 'purchase'}, {'_id': 0}).to_list(10000)
    expenses = await db.expenses.find({}, {'_id': 0}).to_list(10000)

    total_sales = sum(s.get('total', 0) for s in sales)
    total_purchases = sum(p.get('total', 0) for p in purchases)
    total_expenses = sum(e.get('amount', 0) for e in expenses)

    exp_by_cat = {}
    for e in expenses:
        cat = e.get('category', 'Other')
        exp_by_cat[cat] = exp_by_cat.get(cat, 0) + e.get('amount', 0)

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(['Profit & Loss Statement'])
    writer.writerow([])
    writer.writerow(['Category', 'Type', 'Amount (INR)'])
    writer.writerow(['Total Sales (Revenue)', 'Revenue', f"{total_sales:.2f}"])
    writer.writerow(['Total Purchases (Cost of Sales)', 'Expense', f"{total_purchases:.2f}"])
    writer.writerow(['Total Direct Expenses', 'Expense', f"{total_expenses:.2f}"])
    writer.writerow(['Gross Profit', 'Profit', f"{(total_sales - total_purchases):.2f}"])
    writer.writerow(['Net Profit', 'Profit', f"{(total_sales - total_purchases - total_expenses):.2f}"])
    writer.writerow([])
    writer.writerow(['Expenses Breakdown by Category'])
    writer.writerow(['Category', 'Amount (INR)'])
    for cat, amt in sorted(exp_by_cat.items(), key=lambda x: -x[1]):
        writer.writerow([cat, f"{amt:.2f}"])

    return Response(
        content=output.getvalue(),
        media_type='text/csv',
        headers={
            'Content-Disposition': 'attachment; filename=pnl_report.csv',
            'Access-Control-Expose-Headers': 'Content-Disposition'
        }
    )

# ----------------- Seed -----------------
@api.post('/seed')
async def seed_data():
    """Seed demo data. Idempotent-ish: creates admin if not present."""
    admin_email = 'admin@lotuserp.com'
    existing = await db.users.find_one({'email': admin_email})
    if not existing:
        admin = {
            'id': str(uuid.uuid4()),
            'email': admin_email,
            'name': 'Admin',
            'business_name': 'LotusERP Demo Store',
            'role': 'Owner',
            'password_hash': hash_pw('admin123'),
            'created_at': datetime.now(timezone.utc).isoformat(),
        }
        await db.users.insert_one(admin)

    if await db.products.count_documents({}) == 0:
        demo_products = [
            {'name': 'Royal King Mattress 6x6', 'category': 'Mattress', 'purchase_price': 8500, 'selling_price': 14999, 'gst_rate': 18, 'stock': 12, 'unit': 'pcs', 'hsn': '9404', 'brand': 'DreamRest', 'color': 'Ivory'},
            {'name': 'Silk Curtain Fabric', 'category': 'Curtain', 'purchase_price': 220, 'selling_price': 450, 'gst_rate': 5, 'stock': 340, 'unit': 'mtr', 'hsn': '5407', 'brand': 'LuxeDrape', 'color': 'Beige'},
            {'name': 'Velvet Sofa Fabric', 'category': 'Sofa Fabric', 'purchase_price': 380, 'selling_price': 799, 'gst_rate': 5, 'stock': 180, 'unit': 'mtr', 'hsn': '5801', 'brand': 'PlushHome', 'color': 'Emerald'},
            {'name': 'Persian Carpet 5x7', 'category': 'Carpet', 'purchase_price': 4200, 'selling_price': 8999, 'gst_rate': 12, 'stock': 8, 'unit': 'pcs', 'hsn': '5701', 'brand': 'HeritageWeaves', 'color': 'Maroon'},
            {'name': 'Designer Cushion Cover Set', 'category': 'Cushions', 'purchase_price': 180, 'selling_price': 499, 'gst_rate': 12, 'stock': 45, 'unit': 'set', 'hsn': '6304', 'brand': 'CasaCraft', 'color': 'Multi'},
            {'name': 'Premium Cotton Bedsheet Set', 'category': 'Bedsheets', 'purchase_price': 550, 'selling_price': 1299, 'gst_rate': 5, 'stock': 22, 'unit': 'set', 'hsn': '6302', 'brand': 'SoftNest', 'color': 'White'},
            {'name': 'Textured Wallpaper Roll', 'category': 'Wallpaper', 'purchase_price': 850, 'selling_price': 1799, 'gst_rate': 12, 'stock': 3, 'unit': 'roll', 'hsn': '4814', 'brand': 'WallArt', 'color': 'Grey'},
            {'name': 'Orthopedic Memory Foam Pillow', 'category': 'Pillows', 'purchase_price': 320, 'selling_price': 799, 'gst_rate': 12, 'stock': 60, 'unit': 'pcs', 'hsn': '9404', 'brand': 'DreamRest', 'color': 'White'},
        ]
        for p in demo_products:
            p['id'] = str(uuid.uuid4())
            p['sku'] = 'SKU-' + p['id'][:6].upper()
            p['warehouse'] = 'Main'
            p['low_stock_alert'] = 5
            p['image_base64'] = None
            p['created_at'] = datetime.now(timezone.utc).isoformat()
        await db.products.insert_many(demo_products)

    if await db.parties.count_documents({}) == 0:
        demo_parties = [
            {'name': 'Rakesh Sharma', 'phone': '9876543210', 'party_type': 'customer', 'opening_balance': 0, 'address': 'Pune, MH', 'gstin': None},
            {'name': 'Meera Interiors', 'phone': '9820098200', 'party_type': 'customer', 'opening_balance': 4500, 'address': 'Mumbai, MH', 'gstin': '27ABCDE1234F1Z5'},
            {'name': 'Sunrise Homes Ltd', 'phone': '9911223344', 'party_type': 'customer', 'opening_balance': 0, 'address': 'Bengaluru, KA', 'gstin': '29XYZAB1234G1Z9'},
            {'name': 'FabricWorld Suppliers', 'phone': '9800011122', 'party_type': 'supplier', 'opening_balance': 12000, 'address': 'Surat, GJ', 'gstin': '24SUPPLR1234H1Z1'},
            {'name': 'DreamRest Manufacturing', 'phone': '9800022233', 'party_type': 'supplier', 'opening_balance': 0, 'address': 'Delhi', 'gstin': '07DREAM1234I1Z2'},
        ]
        for p in demo_parties:
            p['id'] = str(uuid.uuid4())
            p['created_at'] = datetime.now(timezone.utc).isoformat()
        await db.parties.insert_many(demo_parties)

    return {'ok': True, 'admin_email': admin_email}

# ----------------- Custom Orders -----------------
class CustomOrderItem(BaseModel):
    product_name: str
    order_type: Literal['curtain_stitching', 'mattress_custom', 'sofa_cutting', 'other'] = 'other'
    measurements: dict = {}  # freeform: width, height, length, thickness, quantity
    price: float = 0
    notes: Optional[str] = None

class CustomOrderIn(BaseModel):
    customer_id: Optional[str] = None
    customer_name: str = 'Walk-in'
    items: List[CustomOrderItem]
    advance_paid: float = 0
    expected_delivery: Optional[str] = None
    notes: Optional[str] = None

class CustomOrderStatusIn(BaseModel):
    new_status: Literal['Pending', 'In Production', 'Ready', 'Delivered', 'Cancelled']

@api.get('/custom-orders')
async def list_custom_orders(status_filter: Optional[str] = None, user=Depends(get_current_user)):
    q = {}
    if status_filter:
        q['status'] = status_filter
    cursor = db.custom_orders.find(q, {'_id': 0}).sort('created_at', -1)
    return await cursor.to_list(500)

@api.post('/custom-orders')
async def create_custom_order(payload: CustomOrderIn, user=Depends(require_roles(['Owner', 'Manager', 'Sales']))):
    total = sum((i.price or 0) for i in payload.items)
    count = await db.custom_orders.count_documents({})
    doc = {
        'id': str(uuid.uuid4()),
        'order_number': f'CO-{(count + 1):05d}',
        'customer_id': payload.customer_id,
        'customer_name': payload.customer_name,
        'items': [i.dict() for i in payload.items],
        'total': round(total, 2),
        'advance_paid': payload.advance_paid,
        'balance_due': round(total - payload.advance_paid, 2),
        'expected_delivery': payload.expected_delivery,
        'notes': payload.notes,
        'status': 'Pending',
        'created_at': datetime.now(timezone.utc).isoformat(),
        'created_by': user['id'],
    }
    await db.custom_orders.insert_one(doc)
    return clean(doc)

@api.get('/custom-orders/{cid}')
async def get_custom_order(cid: str, user=Depends(get_current_user)):
    doc = await db.custom_orders.find_one({'id': cid}, {'_id': 0})
    if not doc:
        raise HTTPException(404, 'Not found')
    return doc

@api.put('/custom-orders/{cid}/status')
async def update_custom_order_status(cid: str, payload: CustomOrderStatusIn, user=Depends(require_roles(['Owner', 'Manager', 'Sales']))):
    res = await db.custom_orders.find_one_and_update({'id': cid}, {'$set': {'status': payload.new_status}})
    if not res:
        raise HTTPException(404, 'Not found')
    doc = await db.custom_orders.find_one({'id': cid}, {'_id': 0})
    return doc

# ----------------- Manufacturing -----------------
class RawMaterial(BaseModel):
    name: str
    quantity: float
    unit: str = 'pcs'
    cost: float = 0

class ManufacturingIn(BaseModel):
    product_id: Optional[str] = None
    product_name: str
    batch_number: Optional[str] = None
    quantity: float
    raw_materials: List[RawMaterial] = []
    labor_cost: float = 0
    wastage: float = 0
    notes: Optional[str] = None

@api.get('/manufacturing')
async def list_manufacturing(user=Depends(get_current_user)):
    cursor = db.manufacturing.find({}, {'_id': 0}).sort('created_at', -1)
    return await cursor.to_list(500)

@api.post('/manufacturing')
async def create_manufacturing(payload: ManufacturingIn, user=Depends(require_roles(['Owner', 'Manager', 'Warehouse']))):
    raw_cost = sum((r.cost or 0) for r in payload.raw_materials)
    total_cost = raw_cost + (payload.labor_cost or 0)
    per_unit = total_cost / payload.quantity if payload.quantity > 0 else 0
    count = await db.manufacturing.count_documents({})
    doc = {
        'id': str(uuid.uuid4()),
        'batch_number': payload.batch_number or f'BATCH-{(count + 1):05d}',
        'product_id': payload.product_id,
        'product_name': payload.product_name,
        'quantity': payload.quantity,
        'raw_materials': [r.dict() for r in payload.raw_materials],
        'raw_cost': round(raw_cost, 2),
        'labor_cost': payload.labor_cost or 0,
        'wastage': payload.wastage or 0,
        'total_cost': round(total_cost, 2),
        'per_unit_cost': round(per_unit, 2),
        'notes': payload.notes,
        'status': 'Completed',
        'created_at': datetime.now(timezone.utc).isoformat(),
    }
    await db.manufacturing.insert_one(doc)
    # increment product stock if product linked
    if payload.product_id:
        await db.products.update_one({'id': payload.product_id}, {'$inc': {'stock': payload.quantity}})
    return clean(doc)

# ----------------- Fabric Rolls -----------------
class FabricRollIn(BaseModel):
    name: str
    color: Optional[str] = None
    pattern: Optional[str] = None
    supplier_id: Optional[str] = None
    supplier_name: Optional[str] = None
    purchase_date: Optional[str] = None
    total_length: float
    used_length: float = 0
    cost_per_meter: float = 0
    barcode: Optional[str] = None

class RollUsageIn(BaseModel):
    length: float
    notes: Optional[str] = None

@api.get('/rolls')
async def list_rolls(user=Depends(get_current_user)):
    cursor = db.fabric_rolls.find({}, {'_id': 0}).sort('created_at', -1)
    rolls = await cursor.to_list(500)
    for r in rolls:
        r['remaining_length'] = round((r.get('total_length', 0) or 0) - (r.get('used_length', 0) or 0), 2)
    return rolls

@api.post('/rolls')
async def create_roll(payload: FabricRollIn, user=Depends(require_roles(['Owner', 'Manager', 'Warehouse']))):
    count = await db.fabric_rolls.count_documents({})
    doc = payload.dict()
    doc['id'] = str(uuid.uuid4())
    doc['roll_number'] = f'ROLL-{(count + 1):05d}'
    doc['usage_history'] = []
    doc['created_at'] = datetime.now(timezone.utc).isoformat()
    if not doc.get('purchase_date'):
        doc['purchase_date'] = doc['created_at'][:10]
    await db.fabric_rolls.insert_one(doc)
    doc['remaining_length'] = round(doc['total_length'] - doc.get('used_length', 0), 2)
    return clean(doc)

@api.post('/rolls/{rid}/consume')
async def consume_roll(rid: str, payload: RollUsageIn, user=Depends(require_roles(['Owner', 'Manager', 'Warehouse']))):
    roll = await db.fabric_rolls.find_one({'id': rid})
    if not roll:
        raise HTTPException(404, 'Roll not found')
    remaining = (roll.get('total_length', 0) or 0) - (roll.get('used_length', 0) or 0)
    if payload.length > remaining:
        raise HTTPException(400, f'Only {remaining} meters remaining')
    entry = {
        'length': payload.length,
        'notes': payload.notes,
        'used_at': datetime.now(timezone.utc).isoformat(),
        'by': user['id'],
    }
    await db.fabric_rolls.update_one(
        {'id': rid},
        {'$inc': {'used_length': payload.length}, '$push': {'usage_history': entry}}
    )
    doc = await db.fabric_rolls.find_one({'id': rid}, {'_id': 0})
    doc['remaining_length'] = round((doc.get('total_length', 0) or 0) - (doc.get('used_length', 0) or 0), 2)
    return doc

@api.delete('/rolls/{rid}')
async def delete_roll(rid: str, user=Depends(require_roles(['Owner', 'Manager']))):
    await db.fabric_rolls.delete_one({'id': rid})
    return {'ok': True}

# ----------------- Deliveries -----------------
class DeliveryIn(BaseModel):
    invoice_id: Optional[str] = None
    invoice_number: Optional[str] = None
    customer_name: str
    customer_phone: Optional[str] = None
    address: Optional[str] = None
    driver_name: Optional[str] = None
    vehicle: Optional[str] = None
    scheduled_date: Optional[str] = None
    notes: Optional[str] = None

class DeliveryStatusIn(BaseModel):
    new_status: Literal['Assigned', 'Out for Delivery', 'Delivered', 'Failed', 'Cancelled']

class DeliveryConfirmIn(BaseModel):
    otp: str
    photo_base64: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None

def make_otp() -> str:
    import random
    return f'{random.randint(1000, 9999)}'

@api.get('/deliveries')
async def list_deliveries(status_filter: Optional[str] = None, user=Depends(get_current_user)):
    q = {}
    if status_filter:
        q['status'] = status_filter
    cursor = db.deliveries.find(q, {'_id': 0}).sort('created_at', -1)
    return await cursor.to_list(500)

@api.post('/deliveries')
async def create_delivery(payload: DeliveryIn, user=Depends(require_roles(['Owner', 'Manager', 'Warehouse']))):
    count = await db.deliveries.count_documents({})
    doc = payload.dict()
    doc['id'] = str(uuid.uuid4())
    doc['delivery_number'] = f'DEL-{(count + 1):05d}'
    doc['otp'] = make_otp()
    doc['status'] = 'Assigned'
    doc['photo_base64'] = None
    doc['delivered_at'] = None
    doc['latitude'] = None
    doc['longitude'] = None
    doc['created_at'] = datetime.now(timezone.utc).isoformat()
    await db.deliveries.insert_one(doc)
    return clean(doc)

@api.get('/deliveries/{did}')
async def get_delivery(did: str, user=Depends(get_current_user)):
    doc = await db.deliveries.find_one({'id': did}, {'_id': 0})
    if not doc:
        raise HTTPException(404, 'Not found')
    return doc

@api.put('/deliveries/{did}/status')
async def update_delivery_status(did: str, payload: DeliveryStatusIn, user=Depends(get_current_user)):
    await db.deliveries.update_one({'id': did}, {'$set': {'status': payload.new_status}})
    doc = await db.deliveries.find_one({'id': did}, {'_id': 0})
    if not doc:
        raise HTTPException(404, 'Not found')
    return doc

@api.post('/deliveries/{did}/confirm')
async def confirm_delivery(did: str, payload: DeliveryConfirmIn, user=Depends(get_current_user)):
    doc = await db.deliveries.find_one({'id': did})
    if not doc:
        raise HTTPException(404, 'Not found')
    if doc.get('otp') != payload.otp:
        raise HTTPException(400, 'Invalid OTP')
    updates = {
        'status': 'Delivered',
        'photo_base64': payload.photo_base64,
        'latitude': payload.latitude,
        'longitude': payload.longitude,
        'delivered_at': datetime.now(timezone.utc).isoformat(),
    }
    await db.deliveries.update_one({'id': did}, {'$set': updates})
    updated = await db.deliveries.find_one({'id': did}, {'_id': 0})
    return updated

# ----------------- Barcode lookup -----------------
@api.get('/products/by-barcode/{code}')
async def product_by_barcode(code: str, user=Depends(get_current_user)):
    doc = await db.products.find_one({'$or': [{'barcode': code}, {'sku': code}]}, {'_id': 0})
    if not doc:
        raise HTTPException(404, 'Product not found for this code')
    return doc

@api.get('/')
async def root():
    return {'app': 'LotusERP', 'status': 'ok'}

app.include_router(api)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=['*'],
    allow_methods=['*'],
    allow_headers=['*'],
)

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

@app.on_event('startup')
async def on_startup():
    await db.users.create_index('email', unique=True)
    await db.products.create_index('id', unique=True)
    await db.parties.create_index('id', unique=True)
    await db.invoices.create_index('id', unique=True)
    await db.expenses.create_index('id', unique=True)

@app.on_event('shutdown')
async def shutdown_db_client():
    client.close()
