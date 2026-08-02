"""V2 backend tests: custom orders, manufacturing, fabric rolls, deliveries, barcode."""
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
def auth_headers(session):
    session.post(f"{API}/seed", timeout=30)
    r = session.post(f"{API}/auth/login", json={"email": "admin@lotuserp.com", "password": "admin123"}, timeout=30)
    assert r.status_code == 200, r.text
    return {"Authorization": f"Bearer {r.json()['access_token']}", "Content-Type": "application/json"}


# ------------------ Custom Orders ------------------
class TestCustomOrders:
    def test_create_list_status_flow(self, session, auth_headers):
        payload = {
            "customer_name": "TEST_CO_Customer",
            "items": [
                {"product_name": "Silk Curtain Stitch", "order_type": "curtain_stitching",
                 "measurements": {"width": 60, "height": 90}, "price": 1500},
                {"product_name": "Custom Mattress", "order_type": "mattress_custom",
                 "measurements": {"length": 72, "width": 60, "thickness": 8}, "price": 8500}
            ],
            "advance_paid": 2000,
            "notes": "TEST"
        }
        r = session.post(f"{API}/custom-orders", headers=auth_headers, json=payload)
        assert r.status_code == 200, r.text
        j = r.json()
        assert j["total"] == 10000
        assert j["balance_due"] == 8000
        assert j["order_number"].startswith("CO-")
        assert j["status"] == "Pending"
        cid = j["id"]

        # GET single
        got = session.get(f"{API}/custom-orders/{cid}", headers=auth_headers)
        assert got.status_code == 200
        assert got.json()["id"] == cid

        # LIST all
        lst = session.get(f"{API}/custom-orders", headers=auth_headers)
        assert lst.status_code == 200
        assert any(x["id"] == cid for x in lst.json())

        # LIST with status_filter
        lst2 = session.get(f"{API}/custom-orders", headers=auth_headers, params={"status_filter": "Pending"})
        assert lst2.status_code == 200
        assert all(x["status"] == "Pending" for x in lst2.json())

        # Status flow: Pending → In Production → Ready → Delivered
        for st in ["In Production", "Ready", "Delivered"]:
            u = session.put(f"{API}/custom-orders/{cid}/status", headers=auth_headers, json={"new_status": st})
            assert u.status_code == 200, u.text
            assert u.json()["status"] == st

    def test_get_missing(self, session, auth_headers):
        r = session.get(f"{API}/custom-orders/does-not-exist", headers=auth_headers)
        assert r.status_code == 404


# ------------------ Manufacturing ------------------
class TestManufacturing:
    def test_create_and_stock_increment(self, session, auth_headers):
        prods = session.get(f"{API}/products", headers=auth_headers).json()
        prod = prods[0]
        pid = prod["id"]
        init_stock = prod["stock"]

        payload = {
            "product_id": pid,
            "product_name": prod["name"],
            "quantity": 5,
            "raw_materials": [
                {"name": "Fabric", "quantity": 10, "unit": "mtr", "cost": 300},
                {"name": "Thread", "quantity": 2, "unit": "pcs", "cost": 50},
            ],
            "labor_cost": 200,
            "wastage": 5,
            "notes": "TEST batch"
        }
        r = session.post(f"{API}/manufacturing", headers=auth_headers, json=payload)
        assert r.status_code == 200, r.text
        j = r.json()
        assert j["raw_cost"] == 350
        assert j["total_cost"] == 550
        assert j["per_unit_cost"] == 110
        assert j["batch_number"].startswith("BATCH-")

        # verify stock incremented
        refreshed = session.get(f"{API}/products", headers=auth_headers).json()
        after = next(p for p in refreshed if p["id"] == pid)
        assert after["stock"] == init_stock + 5

    def test_list(self, session, auth_headers):
        r = session.get(f"{API}/manufacturing", headers=auth_headers)
        assert r.status_code == 200
        assert isinstance(r.json(), list)


# ------------------ Fabric Rolls ------------------
class TestRolls:
    def test_create_consume_reject_delete(self, session, auth_headers):
        payload = {"name": "TEST_Silk Roll", "color": "Red", "pattern": "Plain",
                   "total_length": 50, "cost_per_meter": 100}
        r = session.post(f"{API}/rolls", headers=auth_headers, json=payload)
        assert r.status_code == 200, r.text
        j = r.json()
        assert j["roll_number"].startswith("ROLL-")
        assert j["remaining_length"] == 50
        rid = j["id"]

        # List returns with remaining_length computed
        lst = session.get(f"{API}/rolls", headers=auth_headers)
        assert lst.status_code == 200
        found = next(x for x in lst.json() if x["id"] == rid)
        assert found["remaining_length"] == 50

        # Consume 20
        c = session.post(f"{API}/rolls/{rid}/consume", headers=auth_headers,
                         json={"length": 20, "notes": "test cut"})
        assert c.status_code == 200
        cj = c.json()
        assert cj["remaining_length"] == 30
        assert cj["used_length"] == 20
        assert len(cj["usage_history"]) == 1

        # Reject over-consume
        over = session.post(f"{API}/rolls/{rid}/consume", headers=auth_headers, json={"length": 1000})
        assert over.status_code == 400

        # Delete
        d = session.delete(f"{API}/rolls/{rid}", headers=auth_headers)
        assert d.status_code == 200


# ------------------ Deliveries ------------------
class TestDeliveries:
    def test_delivery_flow_with_otp(self, session, auth_headers):
        payload = {
            "customer_name": "TEST_DEL_Cust",
            "customer_phone": "9999999999",
            "address": "TEST Address",
            "driver_name": "Ramesh",
            "vehicle": "MH-12-AB-1234",
        }
        r = session.post(f"{API}/deliveries", headers=auth_headers, json=payload)
        assert r.status_code == 200, r.text
        j = r.json()
        assert j["delivery_number"].startswith("DEL-")
        assert j["status"] == "Assigned"
        assert len(j["otp"]) == 4 and j["otp"].isdigit()
        otp = j["otp"]
        did = j["id"]

        # Update status to Out for Delivery
        u = session.put(f"{API}/deliveries/{did}/status", headers=auth_headers,
                        json={"new_status": "Out for Delivery"})
        assert u.status_code == 200, u.text
        assert u.json()["status"] == "Out for Delivery"

        # Wrong OTP -> 400
        bad = session.post(f"{API}/deliveries/{did}/confirm", headers=auth_headers,
                           json={"otp": "0000" if otp != "0000" else "1111"})
        assert bad.status_code == 400

        # Correct OTP -> Delivered
        ok = session.post(f"{API}/deliveries/{did}/confirm", headers=auth_headers,
                          json={"otp": otp, "photo_base64": "data:image/png;base64,AAA",
                                "latitude": 19.076, "longitude": 72.877})
        assert ok.status_code == 200, ok.text
        oj = ok.json()
        assert oj["status"] == "Delivered"
        assert oj["photo_base64"] == "data:image/png;base64,AAA"
        assert oj["latitude"] == 19.076
        assert oj["longitude"] == 72.877
        assert oj["delivered_at"] is not None

    def test_list_with_filter(self, session, auth_headers):
        r = session.get(f"{API}/deliveries", headers=auth_headers, params={"status_filter": "Delivered"})
        assert r.status_code == 200
        assert all(d["status"] == "Delivered" for d in r.json())


# ------------------ Barcode lookup ------------------
class TestBarcode:
    def test_product_by_barcode_and_sku(self, session, auth_headers):
        # create a product with barcode
        payload = {"name": "TEST_Barcode_Prod", "barcode": "TEST_BC_123456",
                   "purchase_price": 10, "selling_price": 20, "gst_rate": 5, "stock": 10}
        c = session.post(f"{API}/products", headers=auth_headers, json=payload)
        assert c.status_code == 200
        prod = c.json()
        pid = prod["id"]
        sku = prod["sku"]

        # lookup by barcode
        r1 = session.get(f"{API}/products/by-barcode/TEST_BC_123456", headers=auth_headers)
        assert r1.status_code == 200
        assert r1.json()["id"] == pid

        # lookup by SKU
        r2 = session.get(f"{API}/products/by-barcode/{sku}", headers=auth_headers)
        assert r2.status_code == 200
        assert r2.json()["id"] == pid

        # unknown
        r3 = session.get(f"{API}/products/by-barcode/NOPE_UNKNOWN_999", headers=auth_headers)
        assert r3.status_code == 404

        # cleanup
        session.delete(f"{API}/products/{pid}", headers=auth_headers)


# ------------------ Regression: existing endpoints ------------------
class TestRegression:
    def test_dashboard_ok(self, session, auth_headers):
        r = session.get(f"{API}/dashboard", headers=auth_headers)
        assert r.status_code == 200
        assert "today_sales" in r.json()

    def test_products_list(self, session, auth_headers):
        r = session.get(f"{API}/products", headers=auth_headers)
        assert r.status_code == 200 and len(r.json()) >= 8

    def test_parties_list(self, session, auth_headers):
        r = session.get(f"{API}/parties", headers=auth_headers)
        assert r.status_code == 200

    def test_reports_gst(self, session, auth_headers):
        assert session.get(f"{API}/reports/gst", headers=auth_headers).status_code == 200

    def test_reports_pnl(self, session, auth_headers):
        assert session.get(f"{API}/reports/pnl", headers=auth_headers).status_code == 200
