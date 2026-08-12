"""End-to-end backend tests for LotusERP FastAPI backend."""
import os
import uuid
import pytest
import requests

BASE_URL = os.environ.get("EXPO_PUBLIC_BACKEND_URL", "https://home-sync-10.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"


@pytest.fixture(scope="session")
def session():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


@pytest.fixture(scope="session")
def admin_token(session):
    # Ensure seed is executed
    session.post(f"{API}/seed", timeout=30)
    r = session.post(f"{API}/auth/login", json={"email": "admin@lotuserp.com", "password": "admin123"}, timeout=30)
    assert r.status_code == 200, f"Login failed: {r.text}"
    data = r.json()
    assert "access_token" in data
    return data["access_token"]


@pytest.fixture(scope="session")
def auth_headers(admin_token):
    return {"Authorization": f"Bearer {admin_token}", "Content-Type": "application/json"}


# ---------- Health / Seed ----------
class TestHealth:
    def test_root(self, session):
        r = session.get(f"{API}/", timeout=15)
        assert r.status_code == 200
        assert r.json().get("app") == "LotusERP"

    def test_seed_idempotent(self, session):
        r = session.post(f"{API}/seed", timeout=30)
        assert r.status_code == 200
        assert r.json().get("ok") is True


# ---------- Auth ----------
class TestAuth:
    def test_login_admin(self, session):
        r = session.post(f"{API}/auth/login", json={"email": "admin@lotuserp.com", "password": "admin123"})
        assert r.status_code == 200
        j = r.json()
        assert "access_token" in j and j["user"]["email"] == "admin@lotuserp.com"

    def test_login_bad_password(self, session):
        r = session.post(f"{API}/auth/login", json={"email": "admin@lotuserp.com", "password": "wrong"})
        assert r.status_code == 401

    def test_register_and_me(self, session):
        email = f"test_{uuid.uuid4().hex[:8]}@example.com"
        r = session.post(f"{API}/auth/register", json={"email": email, "password": "secret123", "name": "TEST User"})
        assert r.status_code == 200, r.text
        token = r.json()["access_token"]
        me = session.get(f"{API}/auth/me", headers={"Authorization": f"Bearer {token}"})
        assert me.status_code == 200
        assert me.json()["email"] == email

    def test_register_duplicate(self, session):
        email = f"dup_{uuid.uuid4().hex[:8]}@example.com"
        payload = {"email": email, "password": "secret123", "name": "TEST Dup"}
        r1 = session.post(f"{API}/auth/register", json=payload)
        assert r1.status_code == 200
        r2 = session.post(f"{API}/auth/register", json=payload)
        assert r2.status_code == 400

    def test_me_unauthorized(self, session):
        r = session.get(f"{API}/auth/me")
        assert r.status_code == 401

    def test_me_invalid_token(self, session):
        r = session.get(f"{API}/auth/me", headers={"Authorization": "Bearer badtoken"})
        assert r.status_code == 401


# ---------- Products ----------
class TestProducts:
    def test_list_seeded_products(self, session, auth_headers):
        r = session.get(f"{API}/products", headers=auth_headers)
        assert r.status_code == 200
        products = r.json()
        assert isinstance(products, list)
        assert len(products) >= 8, f"Expected >=8 seeded products, got {len(products)}"

    def test_categories(self, session, auth_headers):
        r = session.get(f"{API}/products/categories", headers=auth_headers)
        assert r.status_code == 200
        cats = r.json()
        assert isinstance(cats, list) and len(cats) > 0

    def test_create_update_delete_product(self, session, auth_headers):
        payload = {"name": "TEST_Product", "category": "Curtain", "purchase_price": 100, "selling_price": 250, "gst_rate": 5, "stock": 20}
        r = session.post(f"{API}/products", headers=auth_headers, json=payload)
        assert r.status_code == 200, r.text
        pid = r.json()["id"]
        # Verify via list
        got = session.get(f"{API}/products", headers=auth_headers, params={"q": "TEST_Product"})
        assert any(p["id"] == pid for p in got.json())
        # Update
        payload["selling_price"] = 300
        payload["stock"] = 15
        u = session.put(f"{API}/products/{pid}", headers=auth_headers, json=payload)
        assert u.status_code == 200
        assert u.json()["selling_price"] == 300
        # Delete
        d = session.delete(f"{API}/products/{pid}", headers=auth_headers)
        assert d.status_code == 200

    def test_products_unauthorized(self, session):
        r = session.get(f"{API}/products")
        assert r.status_code == 401


# ---------- Parties ----------
class TestParties:
    def test_customers(self, session, auth_headers):
        r = session.get(f"{API}/parties", headers=auth_headers, params={"party_type": "customer"})
        assert r.status_code == 200
        parties = r.json()
        assert isinstance(parties, list) and len(parties) >= 1
        assert all(p.get("party_type") == "customer" for p in parties)
        assert all("outstanding" in p for p in parties)

    def test_suppliers(self, session, auth_headers):
        r = session.get(f"{API}/parties", headers=auth_headers, params={"party_type": "supplier"})
        assert r.status_code == 200
        parties = r.json()
        assert len(parties) >= 1
        assert all(p.get("party_type") == "supplier" for p in parties)

    def test_create_party(self, session, auth_headers):
        payload = {"name": "TEST_Customer", "phone": "9990001111", "party_type": "customer", "opening_balance": 500}
        r = session.post(f"{API}/parties", headers=auth_headers, json=payload)
        assert r.status_code == 200
        pid = r.json()["id"]
        session.delete(f"{API}/parties/{pid}", headers=auth_headers)


# ---------- Invoices ----------
class TestInvoices:
    def test_create_sale_invoice_and_stock_decrement(self, session, auth_headers):
        # get a product
        products = session.get(f"{API}/products", headers=auth_headers).json()
        assert products
        prod = products[0]
        pid = prod["id"]
        initial_stock = prod.get("stock", 0)
        qty = 2
        payload = {
            "customer_name": "TEST_Walkin",
            "items": [{
                "product_id": pid, "name": prod["name"], "quantity": qty,
                "price": prod["selling_price"], "gst_rate": prod.get("gst_rate", 5), "discount": 0
            }],
            "payment_method": "Cash",
            "amount_paid": 0,
            "kind": "sale",
        }
        r = session.post(f"{API}/invoices", headers=auth_headers, json=payload)
        assert r.status_code == 200, r.text
        inv = r.json()
        # Compute expected
        line = prod["selling_price"] * qty
        expected_tax = round(line * prod.get("gst_rate", 5) / 100, 2)
        expected_total = round(line + expected_tax, 2)
        assert inv["subtotal"] == round(line, 2)
        assert inv["tax"] == expected_tax
        assert inv["total"] == expected_total
        assert inv["balance_due"] == expected_total
        assert inv["invoice_number"].startswith("INV-")
        # verify stock decrement
        refreshed = session.get(f"{API}/products", headers=auth_headers).json()
        new_prod = next(p for p in refreshed if p["id"] == pid)
        assert new_prod["stock"] == initial_stock - qty
        # GET invoice
        got = session.get(f"{API}/invoices/{inv['id']}", headers=auth_headers)
        assert got.status_code == 200
        assert got.json()["id"] == inv["id"]

    def test_list_invoices(self, session, auth_headers):
        r = session.get(f"{API}/invoices", headers=auth_headers)
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_empty_items_rejected(self, session, auth_headers):
        r = session.post(f"{API}/invoices", headers=auth_headers, json={"items": [], "payment_method": "Cash"})
        assert r.status_code == 400


# ---------- Expenses ----------
class TestExpenses:
    def test_create_and_list_expense(self, session, auth_headers):
        payload = {"category": "TEST_Rent", "amount": 1234.5, "payment_method": "Cash", "notes": "test"}
        r = session.post(f"{API}/expenses", headers=auth_headers, json=payload)
        assert r.status_code == 200
        eid = r.json()["id"]
        lst = session.get(f"{API}/expenses", headers=auth_headers).json()
        assert any(e["id"] == eid for e in lst)
        session.delete(f"{API}/expenses/{eid}", headers=auth_headers)


# ---------- Dashboard & Reports ----------
class TestDashboard:
    def test_dashboard(self, session, auth_headers):
        r = session.get(f"{API}/dashboard", headers=auth_headers)
        assert r.status_code == 200
        d = r.json()
        for key in ["today_sales", "monthly_sales", "inventory_value", "low_stock_count",
                    "top_products", "sales_trend", "recent_invoices", "business_health",
                    "pending_receivable", "monthly_profit", "total_products"]:
            assert key in d, f"missing {key}"
        assert len(d["sales_trend"]) == 7
        assert isinstance(d["top_products"], list)
        assert isinstance(d["recent_invoices"], list)
        assert 0 <= d["business_health"] <= 100

    def test_reports_gst(self, session, auth_headers):
        r = session.get(f"{API}/reports/gst", headers=auth_headers)
        assert r.status_code == 200
        j = r.json()
        assert "summary" in j and "total_tax" in j and "total_taxable" in j
        assert isinstance(j["summary"], list)

    def test_reports_pnl(self, session, auth_headers):
        r = session.get(f"{API}/reports/pnl", headers=auth_headers)
        assert r.status_code == 200
        j = r.json()
        for k in ["total_sales", "total_purchases", "total_expenses", "gross_profit", "net_profit", "expenses_by_category"]:
            assert k in j

    def test_reports_sales_register(self, session, auth_headers):
        r = session.get(f"{API}/reports/sales-register", headers=auth_headers)
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_reports_unauthorized(self, session):
        for path in ["/dashboard", "/reports/gst", "/reports/pnl", "/reports/sales-register"]:
            r = session.get(f"{API}{path}")
            assert r.status_code == 401, f"{path} should require auth"
