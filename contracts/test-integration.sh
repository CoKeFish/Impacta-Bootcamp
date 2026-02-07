#!/bin/bash
# ==========================================================================
# CoTravel Escrow - Integration Tests (Stellar Testnet)
# ==========================================================================
# Ejecuta flujos completos contra testnet con assertions automaticas.
# Uso: make test-integration (dentro del contenedor soroban-dev)
# ==========================================================================
set -euo pipefail

# Colores
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m'

PASS=0
FAIL=0
CONTRACT_FILE=.contract_id
TOKEN_FILE=.token_id

# --------------------------------------------------------------------------
# Helpers
# --------------------------------------------------------------------------

assert_contains() {
    local label="$1"
    local actual="$2"
    local expected="$3"
    if echo "$actual" | grep -qF "$expected"; then
        echo -e "  ${GREEN}✓${NC} $label"
        PASS=$((PASS + 1))
    else
        echo -e "  ${RED}✗${NC} $label"
        echo -e "    esperado contiene: ${BOLD}$expected${NC}"
        echo -e "    recibido:          ${BOLD}$actual${NC}"
        FAIL=$((FAIL + 1))
    fi
}

assert_equals() {
    local label="$1"
    local actual="$2"
    local expected="$3"
    # Trim whitespace
    actual=$(echo "$actual" | tr -d '[:space:]')
    expected=$(echo "$expected" | tr -d '[:space:]')
    if [ "$actual" = "$expected" ]; then
        echo -e "  ${GREEN}✓${NC} $label"
        PASS=$((PASS + 1))
    else
        echo -e "  ${RED}✗${NC} $label"
        echo -e "    esperado: ${BOLD}$expected${NC}"
        echo -e "    recibido: ${BOLD}$actual${NC}"
        FAIL=$((FAIL + 1))
    fi
}

# Invoke a contract function (sends transaction)
invoke() {
    local source="$1"
    shift
    soroban contract invoke \
        --id "$(cat $CONTRACT_FILE)" \
        --source "$source" \
        --network testnet \
        -- "$@" 2>/dev/null
}

# Invoke a read-only function (no transaction)
query() {
    soroban contract invoke \
        --id "$(cat $CONTRACT_FILE)" \
        --source admin \
        --network testnet \
        --send=no \
        -- "$@" 2>/dev/null
}

addr() {
    soroban keys address "$1" 2>/dev/null
}

# --------------------------------------------------------------------------
# Setup
# --------------------------------------------------------------------------

echo ""
echo -e "${CYAN}══════════════════════════════════════════════════════${NC}"
echo -e "${CYAN}  CoTravel Escrow — Integration Tests (Testnet)${NC}"
echo -e "${CYAN}══════════════════════════════════════════════════════${NC}"
echo ""

echo -e "${YELLOW}[Setup]${NC} Limpiando deploy anterior..."
rm -f $CONTRACT_FILE .trip_id
FRIENDBOT_URL=https://friendbot.stellar.org

echo -e "${YELLOW}[Setup]${NC} Configurando red e identidades..."
make setup-network > /dev/null 2>&1
make setup-identities > /dev/null 2>&1
make setup-token > /dev/null 2>&1

echo -e "${YELLOW}[Setup]${NC} Creando identidades vendor para tests multi-wallet..."
soroban keys generate vendor1 --network testnet --overwrite 2>/dev/null || soroban keys generate vendor1 --network testnet
soroban keys generate vendor2 --network testnet --overwrite 2>/dev/null || soroban keys generate vendor2 --network testnet
curl -s "${FRIENDBOT_URL}?addr=$(soroban keys address vendor1 2>/dev/null)" > /dev/null
curl -s "${FRIENDBOT_URL}?addr=$(soroban keys address vendor2 2>/dev/null)" > /dev/null

echo -e "${YELLOW}[Setup]${NC} Compilando y desplegando contrato..."
make deploy > /dev/null 2>&1
echo -e "${YELLOW}[Setup]${NC} Contract ID: $(cat $CONTRACT_FILE)"
echo -e "${YELLOW}[Setup]${NC} Token ID:    $(cat $TOKEN_FILE)"
echo ""

ORG_ADDR=$(addr organizer)
P1_ADDR=$(addr participant1)
P2_ADDR=$(addr participant2)
V1_ADDR=$(addr vendor1)
V2_ADDR=$(addr vendor2)
TOKEN=$(cat $TOKEN_FILE)

# ==========================================================================
# Test 1: Happy path — create → contribute → auto-complete → release
# ==========================================================================
echo -e "${CYAN}[Test 1] Happy path: create → contribute → complete → release${NC}"

T1=$(invoke organizer create_trip \
    --organizer "$ORG_ADDR" --token "$TOKEN" \
    --target_amount 10000000000 --min_participants 2 \
    --deadline 9999999999 --penalty_percent 10)
assert_equals "create_trip retorna ID 0" "$T1" "0"

STATE=$(query get_state --trip_id 0)
assert_contains "Estado inicial: Funding" "$STATE" '"status":"Funding"'
assert_contains "0 participantes" "$STATE" '"participant_count":0'

invoke participant1 contribute --trip_id 0 --participant "$P1_ADDR" --amount 5000000000 > /dev/null
STATE=$(query get_state --trip_id 0)
assert_contains "Despues de P1: sigue Funding" "$STATE" '"status":"Funding"'
assert_contains "1 participante" "$STATE" '"participant_count":1'
assert_contains "Total: 5 XLM" "$STATE" '"total_collected":"5000000000"'

invoke participant2 contribute --trip_id 0 --participant "$P2_ADDR" --amount 5000000000 > /dev/null
STATE=$(query get_state --trip_id 0)
assert_contains "Despues de P2: auto-Completed" "$STATE" '"status":"Completed"'
assert_contains "Total: 10 XLM" "$STATE" '"total_collected":"10000000000"'
assert_contains "2 participantes" "$STATE" '"participant_count":2'

invoke organizer release --trip_id 0 > /dev/null
STATE=$(query get_state --trip_id 0)
assert_contains "Despues de release: Released" "$STATE" '"status":"Released"'
assert_contains "Total vaciado" "$STATE" '"total_collected":"0"'

echo ""

# ==========================================================================
# Test 2: Withdraw — penalizacion queda en pool
# ==========================================================================
echo -e "${CYAN}[Test 2] Withdraw: penalizacion 10%, penalty queda en pool${NC}"

T2=$(invoke organizer create_trip \
    --organizer "$ORG_ADDR" --token "$TOKEN" \
    --target_amount 10000000000 --min_participants 2 \
    --deadline 9999999999 --penalty_percent 10)
assert_equals "create_trip retorna ID 1" "$T2" "1"

invoke participant1 contribute --trip_id 1 --participant "$P1_ADDR" --amount 5000000000 > /dev/null
invoke participant2 contribute --trip_id 1 --participant "$P2_ADDR" --amount 5000000000 > /dev/null
STATE=$(query get_state --trip_id 1)
assert_contains "Completed tras ambas contribuciones" "$STATE" '"status":"Completed"'

invoke participant1 withdraw --trip_id 1 --participant "$P1_ADDR" > /dev/null
STATE=$(query get_state --trip_id 1)
assert_contains "Revierte a Funding tras withdraw" "$STATE" '"status":"Funding"'
assert_contains "1 participante restante" "$STATE" '"participant_count":1'

BAL_P1=$(query get_balance --trip_id 1 --participant "$P1_ADDR")
assert_equals "P1 balance = 0 (retirado)" "$BAL_P1" '"0"'

BAL_P2=$(query get_balance --trip_id 1 --participant "$P2_ADDR")
assert_equals "P2 balance = 5 XLM (sin redistribucion)" "$BAL_P2" '"5000000000"'

PENALTY_P1=$(query get_penalty --trip_id 1 --participant "$P1_ADDR")
assert_equals "P1 penalty = 0.5 XLM (en pool)" "$PENALTY_P1" '"500000000"'

echo ""

# ==========================================================================
# Test 3: Cancel — reembolso completo sin penalizacion
# ==========================================================================
echo -e "${CYAN}[Test 3] Cancel: reembolso completo sin penalizacion${NC}"

T3=$(invoke organizer create_trip \
    --organizer "$ORG_ADDR" --token "$TOKEN" \
    --target_amount 20000000000 --min_participants 2 \
    --deadline 9999999999 --penalty_percent 15)
assert_equals "create_trip retorna ID 2" "$T3" "2"

invoke participant1 contribute --trip_id 2 --participant "$P1_ADDR" --amount 3000000000 > /dev/null
invoke participant2 contribute --trip_id 2 --participant "$P2_ADDR" --amount 2000000000 > /dev/null
STATE=$(query get_state --trip_id 2)
assert_contains "Funding (no alcanza meta)" "$STATE" '"status":"Funding"'
assert_contains "Total: 5 XLM" "$STATE" '"total_collected":"5000000000"'

invoke organizer cancel --trip_id 2 > /dev/null
STATE=$(query get_state --trip_id 2)
assert_contains "Estado: Cancelled" "$STATE" '"status":"Cancelled"'
assert_contains "Total vaciado (reembolsado)" "$STATE" '"total_collected":"0"'

echo ""

# ==========================================================================
# Test 4: Multi-trip — aislamiento entre viajes
# ==========================================================================
echo -e "${CYAN}[Test 4] Aislamiento entre viajes${NC}"

COUNT=$(query get_trip_count)
assert_equals "3 viajes creados" "$COUNT" "3"

TRIPS=$(query get_trips)
assert_contains "Lista contiene [0,1,2]" "$TRIPS" "[0,1,2]"

INFO_0=$(query get_trip --trip_id 0)
assert_contains "Trip 0: Released" "$INFO_0" '"status":"Released"'

INFO_1=$(query get_trip --trip_id 1)
assert_contains "Trip 1: Funding" "$INFO_1" '"status":"Funding"'

INFO_2=$(query get_trip --trip_id 2)
assert_contains "Trip 2: Cancelled" "$INFO_2" '"status":"Cancelled"'

PARTS_0=$(query get_participants --trip_id 0)
assert_contains "Trip 0 tiene participantes" "$PARTS_0" "$P1_ADDR"

CONFIG_2=$(query get_config --trip_id 2)
assert_contains "Trip 2 penalty = 15%" "$CONFIG_2" '"penalty_percent":15'
assert_contains "Trip 2 target = 20 XLM" "$CONFIG_2" '"target_amount":"20000000000"'

echo ""

# ==========================================================================
# Test 5: Invoice multi-wallet + confirm_release (consentimiento unanime)
# ==========================================================================
echo -e "${CYAN}[Test 5] Invoice multi-wallet + confirm_release${NC}"

RECIPIENTS='[{"address":"'"$V1_ADDR"'","amount":"6000000000"},{"address":"'"$V2_ADDR"'","amount":"4000000000"}]'

T5=$(invoke organizer create_invoice \
    --organizer "$ORG_ADDR" --token "$TOKEN" \
    --target_amount 10000000000 --min_participants 2 \
    --deadline 9999999999 --penalty_percent 10 \
    --recipients "$RECIPIENTS" \
    --auto_release false)
assert_equals "create_invoice retorna ID 3" "$T5" "3"

# Verify recipients stored
RECS=$(query get_recipients --trip_id 3)
assert_contains "Vendor1 en recipients" "$RECS" "$V1_ADDR"
assert_contains "Vendor2 en recipients" "$RECS" "$V2_ADDR"

invoke participant1 contribute --trip_id 3 --participant "$P1_ADDR" --amount 5000000000 > /dev/null
invoke participant2 contribute --trip_id 3 --participant "$P2_ADDR" --amount 5000000000 > /dev/null

STATE=$(query get_state --trip_id 3)
assert_contains "Completed tras contribuciones" "$STATE" '"status":"Completed"'

# P1 confirms
invoke participant1 confirm_release --trip_id 3 --participant "$P1_ADDR" > /dev/null

CONF_P1=$(query get_confirmation --trip_id 3 --participant "$P1_ADDR")
assert_equals "P1 confirmo" "$CONF_P1" "true"

STATE=$(query get_state --trip_id 3)
assert_contains "Sigue Completed (falta P2)" "$STATE" '"status":"Completed"'
assert_contains "confirmation_count = 1" "$STATE" '"confirmation_count":1'

# P2 confirms → all confirmed → auto-release
invoke participant2 confirm_release --trip_id 3 --participant "$P2_ADDR" > /dev/null

STATE=$(query get_state --trip_id 3)
assert_contains "Released tras confirmacion unanime" "$STATE" '"status":"Released"'
assert_contains "Total vaciado" "$STATE" '"total_collected":"0"'

echo ""

# ==========================================================================
# Test 6: Overfunding rejected
# ==========================================================================
echo -e "${CYAN}[Test 6] Overfunding: contribucion que excede target es rechazada${NC}"

T6=$(invoke organizer create_trip \
    --organizer "$ORG_ADDR" --token "$TOKEN" \
    --target_amount 10000000000 --min_participants 2 \
    --deadline 9999999999 --penalty_percent 10)
assert_equals "create_trip retorna ID 4" "$T6" "4"

invoke participant1 contribute --trip_id 4 --participant "$P1_ADDR" --amount 5000000000 > /dev/null

# P2 tries to overfund (5 + 6 > 10) → should fail
if invoke participant2 contribute --trip_id 4 --participant "$P2_ADDR" --amount 6000000000 > /dev/null 2>&1; then
    echo -e "  ${RED}✗${NC} Overfunding deberia ser rechazado"
    FAIL=$((FAIL + 1))
else
    echo -e "  ${GREEN}✓${NC} Overfunding rechazado correctamente"
    PASS=$((PASS + 1))
fi

STATE=$(query get_state --trip_id 4)
assert_contains "Sigue en Funding" "$STATE" '"status":"Funding"'
assert_contains "Total sigue en 5 XLM" "$STATE" '"total_collected":"5000000000"'

echo ""

# ==========================================================================
# Test 7: Auto-release (pago automatico al completar)
# ==========================================================================
echo -e "${CYAN}[Test 7] Auto-release: pago automatico al alcanzar target + min${NC}"

RECIPIENTS='[{"address":"'"$V1_ADDR"'","amount":"6000000000"},{"address":"'"$V2_ADDR"'","amount":"4000000000"}]'

T7=$(invoke organizer create_invoice \
    --organizer "$ORG_ADDR" --token "$TOKEN" \
    --target_amount 10000000000 --min_participants 2 \
    --deadline 9999999999 --penalty_percent 10 \
    --recipients "$RECIPIENTS" \
    --auto_release true)
assert_equals "create_invoice auto_release retorna ID 5" "$T7" "5"

CONFIG_5=$(query get_config --trip_id 5)
assert_contains "auto_release = true" "$CONFIG_5" '"auto_release":true'

invoke participant1 contribute --trip_id 5 --participant "$P1_ADDR" --amount 5000000000 > /dev/null
STATE=$(query get_state --trip_id 5)
assert_contains "Funding con 1 participante" "$STATE" '"status":"Funding"'

# Segunda contribucion alcanza target → auto-release inmediato
invoke participant2 contribute --trip_id 5 --participant "$P2_ADDR" --amount 5000000000 > /dev/null
STATE=$(query get_state --trip_id 5)
assert_contains "Released directo (auto-release)" "$STATE" '"status":"Released"'
assert_contains "Total vaciado" "$STATE" '"total_collected":"0"'

echo ""

# ==========================================================================
# Test 8: Consent — opt-out gratis tras cambio de factura
# ==========================================================================
echo -e "${CYAN}[Test 8] Consent: withdraw sin penalty tras update_recipients${NC}"

RECIPIENTS='[{"address":"'"$V1_ADDR"'","amount":"10000000000"}]'

T8=$(invoke organizer create_invoice \
    --organizer "$ORG_ADDR" --token "$TOKEN" \
    --target_amount 10000000000 --min_participants 2 \
    --deadline 9999999999 --penalty_percent 20 \
    --recipients "$RECIPIENTS" \
    --auto_release false)
assert_equals "create_invoice retorna ID 6" "$T8" "6"

invoke participant1 contribute --trip_id 6 --participant "$P1_ADDR" --amount 5000000000 > /dev/null
invoke participant2 contribute --trip_id 6 --participant "$P2_ADDR" --amount 5000000000 > /dev/null

# Organizer changes the invoice (version 0 → 1)
NEW_RECIPIENTS='[{"address":"'"$V2_ADDR"'","amount":"10000000000"}]'
invoke organizer update_recipients --trip_id 6 --new_recipients "$NEW_RECIPIENTS" > /dev/null

STATE=$(query get_state --trip_id 6)
assert_contains "Version = 1 tras update" "$STATE" '"version":1'

# P1 contributed at version 0, invoice changed to version 1 → free opt-out
invoke participant1 withdraw --trip_id 6 --participant "$P1_ADDR" > /dev/null

PENALTY_P1=$(query get_penalty --trip_id 6 --participant "$P1_ADDR")
assert_equals "P1 sin penalty (opt-out gratis)" "$PENALTY_P1" '"0"'

BAL_P1=$(query get_balance --trip_id 6 --participant "$P1_ADDR")
assert_equals "P1 balance = 0 (retirado)" "$BAL_P1" '"0"'

echo ""

# ==========================================================================
# Test 9: Cancel devuelve penalties acumuladas
# ==========================================================================
echo -e "${CYAN}[Test 9] Cancel: devolucion de penalties a participantes retirados${NC}"

T9=$(invoke organizer create_trip \
    --organizer "$ORG_ADDR" --token "$TOKEN" \
    --target_amount 10000000000 --min_participants 2 \
    --deadline 9999999999 --penalty_percent 10)
assert_equals "create_trip retorna ID 7" "$T9" "7"

invoke participant1 contribute --trip_id 7 --participant "$P1_ADDR" --amount 5000000000 > /dev/null
invoke participant2 contribute --trip_id 7 --participant "$P2_ADDR" --amount 5000000000 > /dev/null

# P1 withdraws with penalty (10% of 5 XLM = 0.5 XLM)
invoke participant1 withdraw --trip_id 7 --participant "$P1_ADDR" > /dev/null

PENALTY_P1=$(query get_penalty --trip_id 7 --participant "$P1_ADDR")
assert_equals "P1 penalty = 0.5 XLM en pool" "$PENALTY_P1" '"500000000"'

# Cancel → everybody refunded, P1 gets penalty back
invoke organizer cancel --trip_id 7 > /dev/null

STATE=$(query get_state --trip_id 7)
assert_contains "Cancelled" "$STATE" '"status":"Cancelled"'
assert_contains "Total vaciado" "$STATE" '"total_collected":"0"'

PENALTY_AFTER=$(query get_penalty --trip_id 7 --participant "$P1_ADDR")
assert_equals "Penalty devuelta (pool limpio)" "$PENALTY_AFTER" '"0"'

echo ""

# ==========================================================================
# Test 10: Deadline claim — refund automatico tras deadline
# ==========================================================================
echo -e "${CYAN}[Test 10] Deadline: claim_deadline refund tras expirar${NC}"

DEADLINE=$(($(date +%s) + 30))

T10=$(invoke organizer create_trip \
    --organizer "$ORG_ADDR" --token "$TOKEN" \
    --target_amount 20000000000 --min_participants 3 \
    --deadline $DEADLINE --penalty_percent 10)
assert_equals "create_trip retorna ID 8" "$T10" "8"

invoke participant1 contribute --trip_id 8 --participant "$P1_ADDR" --amount 3000000000 > /dev/null

STATE=$(query get_state --trip_id 8)
assert_contains "Funding (no alcanza meta ni min)" "$STATE" '"status":"Funding"'

echo -e "  ${YELLOW}⏳${NC} Esperando que pase el deadline (~45s)..."
sleep 45

# Anyone can call claim_deadline — no auth required
invoke admin claim_deadline --trip_id 8 > /dev/null

STATE=$(query get_state --trip_id 8)
assert_contains "Cancelled tras deadline" "$STATE" '"status":"Cancelled"'
assert_contains "Total vaciado (refund)" "$STATE" '"total_collected":"0"'

echo ""

# ==========================================================================
# Resumen
# ==========================================================================
TOTAL=$((PASS + FAIL))
echo -e "${CYAN}══════════════════════════════════════════════════════${NC}"
if [ "$FAIL" -eq 0 ]; then
    echo -e "${GREEN}  ✓ $TOTAL/$TOTAL assertions passed${NC}"
else
    echo -e "${RED}  ✗ $FAIL/$TOTAL assertions failed${NC}"
fi
echo -e "${CYAN}══════════════════════════════════════════════════════${NC}"
echo ""

exit "$FAIL"
