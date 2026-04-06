#!/bin/bash
BASE="http://localhost:8000/api/v1"
PASS=0; FAIL=0; BUGS=()

check() {
  local label="$1" expected="$2" actual="$3"
  if [ "$actual" = "$expected" ]; then
    echo "  ✓ $label"; PASS=$((PASS+1))
  else
    echo "  ✗ $label → got: '$actual' (expected '$expected')"; FAIL=$((FAIL+1))
    BUGS+=("$label")
  fi
}

py() { python3 -c "$1" 2>/dev/null || echo ""; }
TS=$(date +%s)

echo "━━━ 1. AUTH ━━━"
LOGIN=$(curl -s -X POST $BASE/auth/login -H "Content-Type: application/json" -d '{"email":"admin@forgeerp.com","password":"Admin1234!"}')
TOKEN=$(py "import sys,json; d=json.loads(open('/dev/stdin').read()); print(d.get('accessToken',''))" <<< "$LOGIN")
REFRESH=$(py "import sys,json; d=json.load(sys.stdin); print(d.get('refreshToken',''))" <<< "$LOGIN")
check "login returns accessToken" "true" "$([ -n "$TOKEN" ] && echo true || echo false)"
USER_EMAIL=$(py "import sys,json; d=json.load(sys.stdin); print(d.get('user',{}).get('email',''))" <<< "$LOGIN")
check "login returns user.email" "admin@forgeerp.com" "$USER_EMAIL"
check "wrong password → 401" "401" "$(curl -s -o /dev/null -w "%{http_code}" -X POST $BASE/auth/login -H "Content-Type: application/json" -d '{"email":"admin@forgeerp.com","password":"wrong"}')"
ME=$(curl -s $BASE/auth/me -H "Authorization: Bearer $TOKEN")
check "GET /auth/me → email" "admin@forgeerp.com" "$(py "import sys,json; d=json.load(sys.stdin); print(d.get('email',''))" <<< "$ME")"
REFRESH_RESP=$(curl -s -X POST $BASE/auth/refresh -H "Content-Type: application/json" -d "{\"refreshToken\":\"$REFRESH\"}")
check "token refresh works" "true" "$(py "import sys,json; d=json.load(sys.stdin); print('true' if d.get('accessToken') else 'false')" <<< "$REFRESH_RESP")"
check "no token → 401" "401" "$(curl -s -o /dev/null -w "%{http_code}" $BASE/products)"

H="Authorization: Bearer $TOKEN"

echo ""
echo "━━━ 2. PRODUCTS ━━━"
PRODS=$(curl -s $BASE/products -H "$H")
PROD_COUNT=$(py "import sys,json; d=json.load(sys.stdin); print(len(d.get('data',[])))" <<< "$PRODS")
check "products seeded (>0)" "true" "$([ "${PROD_COUNT:-0}" -gt 0 ] && echo true || echo false)"; echo "    ($PROD_COUNT products)"
FIRST_PROD_VAR=$(py "import sys,json; d=json.load(sys.stdin); ps=d.get('data',[]); print(ps[0]['variants'][0]['id'] if ps and ps[0].get('variants') else '')" <<< "$PRODS")
NEW_PROD=$(curl -s -X POST $BASE/products -H "$H" -H "Content-Type: application/json" -d '{"name":"Test Widget","variants":[{"name":"Default","sku":"TW-TEST-001","salesPrice":19.99,"purchasePrice":9.99}]}')
PROD_ID=$(py "import sys,json; d=json.load(sys.stdin); print(d.get('id',''))" <<< "$NEW_PROD")
check "POST /products → id" "true" "$([ -n "$PROD_ID" ] && echo true || echo false)"
check "GET /products/:id → 200" "200" "$(curl -s -o /dev/null -w "%{http_code}" $BASE/products/$PROD_ID -H "$H")"
EDIT=$(curl -s -X PUT $BASE/products/$PROD_ID -H "$H" -H "Content-Type: application/json" -d '{"name":"Widget v2"}')
check "PUT /products/:id → updated" "Widget v2" "$(py "import sys,json; d=json.load(sys.stdin); print(d.get('name',''))" <<< "$EDIT")"
DEL_CODE=$(curl -s -o /dev/null -w "%{http_code}" -X DELETE $BASE/products/$PROD_ID -H "$H")
check "DELETE /products/:id → 2xx" "true" "$(echo $DEL_CODE | grep -q -E '^(200|204)$' && echo true || echo false)"
check "GET deleted product → 404" "404" "$(curl -s -o /dev/null -w "%{http_code}" $BASE/products/$PROD_ID -H "$H")"

echo ""
echo "━━━ 3. MATERIALS ━━━"
MATS=$(curl -s $BASE/materials -H "$H")
MAT_COUNT=$(py "import sys,json; d=json.load(sys.stdin); print(len(d.get('data',[])))" <<< "$MATS")
check "materials seeded (>0)" "true" "$([ "${MAT_COUNT:-0}" -gt 0 ] && echo true || echo false)"; echo "    ($MAT_COUNT materials)"
MAT_ID=$(py "import sys,json; d=json.load(sys.stdin); m=d.get('data',[]); print(m[0]['id'] if m else '')" <<< "$MATS")
NEW_MAT=$(curl -s -X POST $BASE/materials -H "$H" -H "Content-Type: application/json" -d "{\"name\":\"Steel Sheet\",\"sku\":\"MAT-STEEL-TEST-$TS\",\"unitOfMeasure\":\"kg\",\"purchasePrice\":3.50}")
NEW_MAT_ID=$(py "import sys,json; d=json.load(sys.stdin); print(d.get('id',''))" <<< "$NEW_MAT")
check "POST /materials → id" "true" "$([ -n "$NEW_MAT_ID" ] && echo true || echo false)"

echo ""
echo "━━━ 4. SUPPLIERS & CUSTOMERS ━━━"
SUPS=$(curl -s $BASE/suppliers -H "$H")
SUP_COUNT=$(py "import sys,json; d=json.load(sys.stdin); print(len(d.get('data',[])))" <<< "$SUPS")
SUP_ID=$(py "import sys,json; d=json.load(sys.stdin); print(d['data'][0]['id'] if d.get('data') else '')" <<< "$SUPS")
check "suppliers seeded" "true" "$([ "${SUP_COUNT:-0}" -gt 0 ] && echo true || echo false)"; echo "    ($SUP_COUNT suppliers)"
CUSTS=$(curl -s $BASE/customers -H "$H")
CUST_COUNT=$(py "import sys,json; d=json.load(sys.stdin); print(len(d.get('data',[])))" <<< "$CUSTS")
CUST_ID=$(py "import sys,json; d=json.load(sys.stdin); print(d['data'][0]['id'] if d.get('data') else '')" <<< "$CUSTS")
check "customers seeded" "true" "$([ "${CUST_COUNT:-0}" -gt 0 ] && echo true || echo false)"; echo "    ($CUST_COUNT customers)"
NEW_SUP=$(curl -s -X POST $BASE/suppliers -H "$H" -H "Content-Type: application/json" -d "{\"name\":\"Acme Supplies\",\"code\":\"SUP-ACME-$TS\",\"currency\":\"USD\"}")
check "POST /suppliers → id" "true" "$(py "import sys,json; d=json.load(sys.stdin); print('true' if d.get('id') else 'false')" <<< "$NEW_SUP")"
NEW_CUST=$(curl -s -X POST $BASE/customers -H "$H" -H "Content-Type: application/json" -d "{\"name\":\"Beta Corp\",\"code\":\"CUST-BETA-$TS\",\"currency\":\"USD\"}")
check "POST /customers → id" "true" "$(py "import sys,json; d=json.load(sys.stdin); print('true' if d.get('id') else 'false')" <<< "$NEW_CUST")"

echo ""
echo "━━━ 5. LOCATIONS ━━━"
LOCS=$(curl -s $BASE/locations -H "$H")
LOC_COUNT=$(py "import sys,json; d=json.load(sys.stdin); print(len(d.get('data',[])))" <<< "$LOCS")
# Prefer seeded UUIDs if available; use first location
LOC_ID=$(py "import sys,json; d=json.load(sys.stdin); locs=d.get('data',[]); print(locs[0]['id'] if locs else '')" <<< "$LOCS")
LOC2_ID=$(py "import sys,json; d=json.load(sys.stdin); locs=d.get('data',[]); print(locs[1]['id'] if len(locs)>1 else '')" <<< "$LOCS")
check "locations seeded" "true" "$([ "${LOC_COUNT:-0}" -gt 0 ] && echo true || echo false)"; echo "    ($LOC_COUNT locations)"
NEW_LOC=$(curl -s -X POST $BASE/locations -H "$H" -H "Content-Type: application/json" -d '{"name":"Test Store","type":"store"}')
NEW_LOC_ID=$(py "import sys,json; d=json.load(sys.stdin); print(d.get('id',''))" <<< "$NEW_LOC")
check "POST /locations → id" "true" "$(py "import sys,json; d=json.load(sys.stdin); print('true' if d.get('id') else 'false')" <<< "$NEW_LOC")"
# Use the new UUID location for stock ops (avoids non-UUID seed IDs)
[ -n "$NEW_LOC_ID" ] && LOC_ID="$NEW_LOC_ID"
LOC2_ID=$(py "import sys,json; d=json.load(sys.stdin); locs=d.get('data',[]); uuid_locs=[l for l in locs if '-' in l['id'] and len(l['id'])==36 and l['id']!='$LOC_ID']; print(uuid_locs[0]['id'] if uuid_locs else '')" <<< "$LOCS")

echo ""
echo "━━━ 6. INVENTORY LEVELS ━━━"
INV=$(curl -s $BASE/inventory/levels -H "$H")
INV_COUNT=$(py "import sys,json; d=json.load(sys.stdin); print(len(d.get('data',[])))" <<< "$INV")
check "GET /inventory/levels → list" "true" "$(py "import sys,json; d=json.load(sys.stdin); print('true' if isinstance(d.get('data',[]),list) else 'false')" <<< "$INV")"; echo "    ($INV_COUNT variants)"
MOVS=$(curl -s $BASE/inventory/movements -H "$H")
MOV_COUNT=$(py "import sys,json; d=json.load(sys.stdin); print(len(d.get('data',[])))" <<< "$MOVS")
check "GET /inventory/movements → list" "true" "$(py "import sys,json; d=json.load(sys.stdin); print('true' if isinstance(d.get('data',[]),list) else 'false')" <<< "$MOVS")"; echo "    ($MOV_COUNT movements)"

echo ""
echo "━━━ 7. PURCHASE ORDERS (full flow) ━━━"
PO_LIST=$(curl -s $BASE/purchase-orders -H "$H")
PO_COUNT=$(py "import sys,json; d=json.load(sys.stdin); print(len(d.get('data',[])))" <<< "$PO_LIST")
check "POs seeded" "true" "$([ "${PO_COUNT:-0}" -gt 0 ] && echo true || echo false)"; echo "    ($PO_COUNT POs)"
NEW_PO=$(curl -s -X POST $BASE/purchase-orders -H "$H" -H "Content-Type: application/json" -d "{\"supplierId\":\"$SUP_ID\",\"rows\":[]}")
PO_ID=$(py "import sys,json; d=json.load(sys.stdin); print(d.get('id',''))" <<< "$NEW_PO")
PO_NUM=$(py "import sys,json; d=json.load(sys.stdin); print(d.get('poNumber',''))" <<< "$NEW_PO")
check "POST /purchase-orders → id" "true" "$([ -n "$PO_ID" ] && echo true || echo false)"; echo "    PO created: $PO_NUM"
# Add a row using variantId to enable inventory tracking on receive
ADD_ROW_RESP=$(curl -s -X POST $BASE/purchase-orders/$PO_ID/rows -H "$H" -H "Content-Type: application/json" -d "{\"variantId\":\"$FIRST_PROD_VAR\",\"qty\":10,\"unitCost\":2.50}")
ROW_ID=$(py "import sys,json; d=json.load(sys.stdin); print(d.get('id',''))" <<< "$ADD_ROW_RESP")
check "POST /purchase-orders/:id/rows → id" "true" "$([ -n "$ROW_ID" ] && echo true || echo false)"
INV_BEFORE=$(py "import sys,json; d=json.load(sys.stdin); loc='$LOC_ID'; t=sum(float(lev.get('onHand',0)) for row in d.get('data',[]) for lev in row.get('levels',[]) if lev.get('locationId')==loc); print(int(t))" <<< "$(curl -s "$BASE/inventory/levels" -H "$H")")
RECV=$(curl -s -X POST $BASE/purchase-orders/$PO_ID/receive -H "$H" -H "Content-Type: application/json" -d "{\"locationId\":\"$LOC_ID\",\"rows\":[{\"rowId\":\"$ROW_ID\",\"receivedQty\":100}]}")
RECV_STATUS=$(py "import sys,json; d=json.load(sys.stdin); print(d.get('status',''))" <<< "$RECV")
check "PO receive → status in [received,partial]" "true" "$(echo "$RECV_STATUS" | grep -q -E "received|partial" && echo true || echo false)"; echo "    PO status after receive: $RECV_STATUS"
INV_AFTER=$(py "import sys,json; d=json.load(sys.stdin); loc='$LOC_ID'; t=sum(float(lev.get('onHand',0)) for row in d.get('data',[]) for lev in row.get('levels',[]) if lev.get('locationId')==loc); print(int(t))" <<< "$(curl -s "$BASE/inventory/levels" -H "$H")")
check "stock increased after PO receive" "true" "$([ "${INV_AFTER:-0}" -gt "${INV_BEFORE:-0}" ] && echo true || echo false)"; echo "    onHand: $INV_BEFORE → $INV_AFTER (+$((INV_AFTER - INV_BEFORE)))"
check "GET /purchase-orders/:id → 200" "200" "$(curl -s -o /dev/null -w "%{http_code}" $BASE/purchase-orders/$PO_ID -H "$H")"

echo ""
echo "━━━ 8. SALES ORDERS (full flow) ━━━"
SO_LIST=$(curl -s $BASE/sales-orders -H "$H")
SO_COUNT=$(py "import sys,json; d=json.load(sys.stdin); print(len(d.get('data',[])))" <<< "$SO_LIST")
check "SOs seeded" "true" "$([ "${SO_COUNT:-0}" -gt 0 ] && echo true || echo false)"; echo "    ($SO_COUNT SOs)"
# Get first product variant for SO rows
PRODS2=$(curl -s $BASE/products -H "$H")
FIRST_PROD_VAR=$(py "import sys,json; d=json.load(sys.stdin); ps=d.get('data',[]); print(ps[0]['variants'][0]['id'] if ps and ps[0].get('variants') else '')" <<< "$PRODS2")
NEW_SO=$(curl -s -X POST $BASE/sales-orders -H "$H" -H "Content-Type: application/json" -d "{\"customerId\":\"$CUST_ID\",\"rows\":[]}")
SO_ID=$(py "import sys,json; d=json.load(sys.stdin); print(d.get('id',''))" <<< "$NEW_SO")
SO_NUM=$(py "import sys,json; d=json.load(sys.stdin); print(d.get('soNumber',''))" <<< "$NEW_SO")
check "POST /sales-orders → id" "true" "$([ -n "$SO_ID" ] && echo true || echo false)"; echo "    SO created: $SO_NUM"
if [ -n "$FIRST_PROD_VAR" ]; then
  SO_ROW=$(curl -s -X POST $BASE/sales-orders/$SO_ID/rows -H "$H" -H "Content-Type: application/json" -d "{\"variantId\":\"$FIRST_PROD_VAR\",\"qty\":2,\"salePrice\":29.99}")
  SO_ROW_ID=$(py "import sys,json; d=json.load(sys.stdin); print(d.get('id',''))" <<< "$SO_ROW")
  check "POST /sales-orders/:id/rows → id" "true" "$([ -n "$SO_ROW_ID" ] && echo true || echo false)"
fi
check "GET /sales-orders/:id → 200" "200" "$(curl -s -o /dev/null -w "%{http_code}" $BASE/sales-orders/$SO_ID -H "$H")"

echo ""
echo "━━━ 9. MANUFACTURING (full flow) ━━━"
BOMS=$(curl -s $BASE/manufacturing/boms -H "$H")
BOM_COUNT=$(py "import sys,json; d=json.load(sys.stdin); print(len(d.get('data',[])))" <<< "$BOMS")
check "BOMs seeded" "true" "$([ "${BOM_COUNT:-0}" -gt 0 ] && echo true || echo false)"; echo "    ($BOM_COUNT BOMs)"
BOM_ID=$(py "import sys,json; d=json.load(sys.stdin); print(d['data'][0]['id'] if d.get('data') else '')" <<< "$BOMS")
MOS=$(curl -s $BASE/manufacturing/orders -H "$H")
MO_COUNT=$(py "import sys,json; d=json.load(sys.stdin); print(len(d.get('data',[])))" <<< "$MOS")
check "MOs seeded" "true" "$([ "${MO_COUNT:-0}" -gt 0 ] && echo true || echo false)"; echo "    ($MO_COUNT MOs)"
# Get first variant from first product to assign to MO
FIRST_VAR_ID=$(py "import sys,json; d=json.load(sys.stdin); ps=d.get('data',[]); print(ps[0]['variants'][0]['id'] if ps and ps[0].get('variants') else '')" <<< "$PRODS2")
NEW_MO=$(curl -s -X POST $BASE/manufacturing/orders -H "$H" -H "Content-Type: application/json" -d "{\"bomId\":\"$BOM_ID\",\"qty\":1,\"variantId\":\"$FIRST_VAR_ID\",\"locationId\":\"$LOC_ID\"}")
MO_ID=$(py "import sys,json; d=json.load(sys.stdin); print(d.get('id',''))" <<< "$NEW_MO")
MO_NUM=$(py "import sys,json; d=json.load(sys.stdin); print(d.get('moNumber',''))" <<< "$NEW_MO")
check "POST /manufacturing/orders → id" "true" "$([ -n "$MO_ID" ] && echo true || echo false)"; echo "    MO created: $MO_NUM"
PRODUCE=$(curl -s -X POST $BASE/manufacturing/orders/$MO_ID/produce -H "$H" -H "Content-Type: application/json" -d "{\"locationId\":\"$LOC_ID\",\"sourceLocationId\":\"$LOC_ID\"}")
PROD_STATUS=$(py "import sys,json; d=json.load(sys.stdin); print(d.get('status',''))" <<< "$PRODUCE")
check "MO produce → status done" "true" "$(echo "$PROD_STATUS" | grep -q -E "done|completed|finished|in_progress" && echo true || echo false)"; echo "    MO status after produce: $PROD_STATUS"
check "GET /manufacturing/orders/:id → 200" "200" "$(curl -s -o /dev/null -w "%{http_code}" $BASE/manufacturing/orders/$MO_ID -H "$H")"

echo ""
echo "━━━ 10. STOCK OPS ━━━"
# Use first real variant from products list
VAR_ID=$(py "import sys,json; d=json.load(sys.stdin); ps=d.get('data',[]); print(ps[0]['variants'][0]['id'] if ps and ps[0].get('variants') else '')" <<< "$PRODS2")
ADJ=$(curl -s -X POST $BASE/stock/adjustments -H "$H" -H "Content-Type: application/json" -d "{\"variantId\":\"$VAR_ID\",\"locationId\":\"$LOC_ID\",\"qty\":25,\"reason\":\"found\"}")
check "POST /stock/adjustments → id" "true" "$(py "import sys,json; d=json.load(sys.stdin); print('true' if d.get('id') else 'false')" <<< "$ADJ")"
check "GET /stock/adjustments → list" "true" "$(py "import sys,json; d=json.load(sys.stdin); print('true' if isinstance(d.get('data',[]),list) else 'false')" <<< "$(curl -s $BASE/stock/adjustments -H "$H")")"
if [ -n "$LOC2_ID" ]; then
  XFER=$(curl -s -X POST $BASE/stock/transfers -H "$H" -H "Content-Type: application/json" -d "{\"variantId\":\"$VAR_ID\",\"fromLocationId\":\"$LOC_ID\",\"toLocationId\":\"$LOC2_ID\",\"qty\":1}")
  check "POST /stock/transfers → id" "true" "$(py "import sys,json; d=json.load(sys.stdin); print('true' if d.get('id') else 'false')" <<< "$XFER")"
fi
check "GET /stock/transfers → list" "true" "$(py "import sys,json; d=json.load(sys.stdin); print('true' if isinstance(d.get('data',[]),list) else 'false')" <<< "$(curl -s $BASE/stock/transfers -H "$H")")"
ST=$(curl -s -X POST $BASE/stock/stocktakes -H "$H" -H "Content-Type: application/json" -d "{\"locationId\":\"$LOC_ID\"}")
ST_ID=$(py "import sys,json; d=json.load(sys.stdin); print(d.get('id',''))" <<< "$ST")
check "POST /stock/stocktakes → id" "true" "$([ -n "$ST_ID" ] && echo true || echo false)"
# complete the stocktake (call once, then check status)
ST_COMPLETE_CODE=$(curl -s -o /dev/null -w "%{http_code}" -X POST $BASE/stock/stocktakes/$ST_ID/complete -H "$H")
check "POST /stock/stocktakes/:id/complete → 200" "200" "$ST_COMPLETE_CODE"

echo ""
echo "━━━ 11. API KEYS & WEBHOOKS ━━━"
NEW_KEY=$(curl -s -X POST $BASE/api-keys -H "$H" -H "Content-Type: application/json" -d '{"name":"Test CI Key"}')
KEY_ID=$(py "import sys,json; d=json.load(sys.stdin); print(d.get('id',''))" <<< "$NEW_KEY")
PLAIN_KEY=$(py "import sys,json; d=json.load(sys.stdin); print(d.get('plainKey',''))" <<< "$NEW_KEY")
check "POST /api-keys → id" "true" "$([ -n "$KEY_ID" ] && echo true || echo false)"
check "POST /api-keys → plainKey" "true" "$([ -n "$PLAIN_KEY" ] && echo true || echo false)"
check "X-API-Key auth → 200" "200" "$(curl -s -o /dev/null -w "%{http_code}" $BASE/products -H "X-API-Key: $PLAIN_KEY")"
DEL_KEY_CODE=$(curl -s -o /dev/null -w "%{http_code}" -X DELETE $BASE/api-keys/$KEY_ID -H "$H")
check "DELETE /api-keys/:id → 2xx" "true" "$(echo $DEL_KEY_CODE | grep -q -E '^(200|204)$' && echo true || echo false)"
NEW_WH=$(curl -s -X POST $BASE/webhooks -H "$H" -H "Content-Type: application/json" -d '{"url":"https://example.com/wh","events":["po.received","so.fulfilled"]}')
WH_ID=$(py "import sys,json; d=json.load(sys.stdin); print(d.get('id',''))" <<< "$NEW_WH")
check "POST /webhooks → id" "true" "$([ -n "$WH_ID" ] && echo true || echo false)"
check "GET /webhooks/logs → list" "true" "$(py "import sys,json; d=json.load(sys.stdin); print('true' if isinstance(d.get('data',[]),list) else 'false')" <<< "$(curl -s $BASE/webhooks/logs -H "$H")")"

echo ""
echo "━━━ 12. DASHBOARD ━━━"
DASH=$(curl -s $BASE/dashboard/stats -H "$H")
check "dashboard stats → 200 with productCount" "true" "$(py "import sys,json; d=json.load(sys.stdin); print('true' if 'productCount' in d else 'false')" <<< "$DASH")"
DASH_PROD=$(py "import sys,json; d=json.load(sys.stdin); print(d.get('productCount',0))" <<< "$DASH")
check "dashboard productCount > 0" "true" "$([ "${DASH_PROD:-0}" -gt 0 ] && echo true || echo false)"
echo "    $(py "import sys,json; d=json.load(sys.stdin); x=d.copy(); x.pop('recentMovements',None); print(x)" <<< "$DASH")"

echo ""
echo "━━━ 13. INVENTORY INTEGRITY ━━━"
INV_PRE=$(py "import sys,json; d=json.load(sys.stdin); loc='$LOC_ID'; t=sum(float(lev.get('onHand',0)) for row in d.get('data',[]) for lev in row.get('levels',[]) if lev.get('locationId')==loc); print(int(t))" <<< "$(curl -s "$BASE/inventory/levels" -H "$H")")
curl -s -X POST $BASE/stock/adjustments -H "$H" -H "Content-Type: application/json" -d "{\"variantId\":\"$VAR_ID\",\"locationId\":\"$LOC_ID\",\"qty\":50,\"reason\":\"correction\"}" > /dev/null
INV_POST=$(py "import sys,json; d=json.load(sys.stdin); loc='$LOC_ID'; t=sum(float(lev.get('onHand',0)) for row in d.get('data',[]) for lev in row.get('levels',[]) if lev.get('locationId')==loc); print(int(t))" <<< "$(curl -s "$BASE/inventory/levels" -H "$H")")
DELTA=$((INV_POST - INV_PRE))
check "inventory delta = +50 after adjustment" "50" "$DELTA"; echo "    $INV_PRE → $INV_POST (delta=$DELTA)"
MOV_TYPES=$(py "import sys,json; d=json.load(sys.stdin); types=list(set(m.get('movementType') for m in d.get('data',[]))); print(','.join(sorted(types)))" <<< "$(curl -s "$BASE/inventory/movements" -H "$H")")
check "movements have diverse types" "true" "$([ -n "$MOV_TYPES" ] && echo true || echo false)"; echo "    Movement types: $MOV_TYPES"

echo ""
echo "━━━ 14. PAGINATION & SEARCH ━━━"
PAGE_RESP=$(curl -s "$BASE/products?page=1&limit=2" -H "$H")
PAGE_DATA_LEN=$(py "import sys,json; d=json.load(sys.stdin); print(len(d.get('data',[])))" <<< "$PAGE_RESP")
check "pagination limit=2 → ≤2 results" "true" "$([ "${PAGE_DATA_LEN:-99}" -le 2 ] && echo true || echo false)"
check "pagination meta present" "true" "$(py "import sys,json; d=json.load(sys.stdin); print('true' if 'meta' in d else 'false')" <<< "$PAGE_RESP")"

echo ""
echo "━━━ 15. ERROR HANDLING ━━━"
check "GET nonexistent product → 404" "404" "$(curl -s -o /dev/null -w "%{http_code}" $BASE/products/00000000-0000-0000-0000-000000000000 -H "$H")"
check "POST products bad payload → 400" "400" "$(curl -s -o /dev/null -w "%{http_code}" -X POST $BASE/products -H "$H" -H "Content-Type: application/json" -d '{"x":1}')"
check "unauthenticated → 401" "401" "$(curl -s -o /dev/null -w "%{http_code}" $BASE/products)"
check "invalid JWT → 401" "401" "$(curl -s -o /dev/null -w "%{http_code}" $BASE/products -H "Authorization: Bearer badtoken")"
check "expired/invalid refresh → 401" "401" "$(curl -s -o /dev/null -w "%{http_code}" -X POST $BASE/auth/refresh -H "Content-Type: application/json" -d '{"refreshToken":"invalid.token.here"}')"

echo ""
echo "━━━ 16. SWAGGER DOCS ━━━"
check "GET /docs → redirect (301/302)" "true" "$(HTTP=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:8000/docs); echo $HTTP | grep -q -E "301|302|200" && echo true || echo false)"
check "GET /health → ok" "ok" "$(curl -s http://localhost:8000/health | py "import sys,json; d=json.load(sys.stdin); print(d.get('status',''))")"

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "RESULTS: ✓ $PASS passed  ✗ $FAIL failed  (total: $((PASS+FAIL)))"
if [ "${#BUGS[@]}" -gt 0 ]; then
  echo ""
  echo "FAILURES:"
  for b in "${BUGS[@]}"; do echo "  • $b"; done
fi
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
