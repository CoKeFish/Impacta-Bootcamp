# ============================================================================
# CoTravel Escrow Contract - Makefile (Multi-Trip)
# ============================================================================
# Uso: make <comando>
# Ejecutar dentro del contenedor: docker exec -it impacta-soroban-dev bash
# ============================================================================

# Configuracion de red (usando RPC publico de testnet)
NETWORK := testnet
RPC_URL := https://soroban-testnet.stellar.org
FRIENDBOT_URL := https://friendbot.stellar.org
NETWORK_PASSPHRASE := Test SDF Network ; September 2015

# Archivos
WASM := target/wasm32v1-none/release/cotravel_escrow.wasm
CONTRACT_FILE := .contract_id
TOKEN_FILE := .token_id
TRIP_FILE := .trip_id

# Identidades (se crean automaticamente)
ADMIN := admin
ORGANIZER := organizer
PARTICIPANT1 := participant1
PARTICIPANT2 := participant2

# ============================================================================
# BUILD & TEST
# ============================================================================

.PHONY: build
build: ## Compilar el contrato
	soroban contract build

.PHONY: test
test: ## Ejecutar tests
	cargo test

.PHONY: audit
audit: ## Ejecutar cargo-scout-audit (analisis de seguridad)
	cargo scout-audit

.PHONY: test-integration
test-integration: ## Ejecutar tests de integracion en testnet (setup + deploy + flujos)
	@bash test-integration.sh

.PHONY: clean
clean: ## Limpiar artifacts
	cargo clean
	rm -f $(CONTRACT_FILE) $(TOKEN_FILE) $(TRIP_FILE)

# ============================================================================
# SETUP - Configurar identidades y red
# ============================================================================

.PHONY: setup
setup: setup-network setup-identities setup-token ## Setup completo (red + identidades + token)
	@echo "Setup completo"

.PHONY: setup-network
setup-network: ## Configurar red local
	@echo "Configurando red local..."
	@soroban network rm $(NETWORK) 2>/dev/null || true
	soroban network add $(NETWORK) \
		--rpc-url $(RPC_URL) \
		--network-passphrase "$(NETWORK_PASSPHRASE)"

.PHONY: setup-identities
setup-identities: ## Crear identidades de prueba
	@echo "Creando identidades..."
	@soroban keys generate $(ADMIN) --network $(NETWORK) --overwrite 2>/dev/null || soroban keys generate $(ADMIN) --network $(NETWORK)
	@soroban keys generate $(ORGANIZER) --network $(NETWORK) --overwrite 2>/dev/null || soroban keys generate $(ORGANIZER) --network $(NETWORK)
	@soroban keys generate $(PARTICIPANT1) --network $(NETWORK) --overwrite 2>/dev/null || soroban keys generate $(PARTICIPANT1) --network $(NETWORK)
	@soroban keys generate $(PARTICIPANT2) --network $(NETWORK) --overwrite 2>/dev/null || soroban keys generate $(PARTICIPANT2) --network $(NETWORK)
	@echo "Fondando cuentas via friendbot..."
	@curl -s "$(FRIENDBOT_URL)?addr=$$(soroban keys address $(ADMIN))" > /dev/null
	@curl -s "$(FRIENDBOT_URL)?addr=$$(soroban keys address $(ORGANIZER))" > /dev/null
	@curl -s "$(FRIENDBOT_URL)?addr=$$(soroban keys address $(PARTICIPANT1))" > /dev/null
	@curl -s "$(FRIENDBOT_URL)?addr=$$(soroban keys address $(PARTICIPANT2))" > /dev/null
	@echo "Identidades creadas y fondeadas"

.PHONY: setup-token
setup-token: ## Obtener token nativo (XLM wrapper)
	@echo "Obteniendo ID del token nativo..."
	@soroban contract id asset --asset native --network $(NETWORK) > $(TOKEN_FILE)
	@echo "Token ID: $$(cat $(TOKEN_FILE))"
	@echo "Token configurado (los participantes ya tienen XLM de friendbot)"

# ============================================================================
# DEPLOY
# ============================================================================

.PHONY: deploy
deploy: build ## Desplegar contrato
	@echo "Desplegando contrato..."
	@soroban contract deploy \
		--wasm $(WASM) \
		--source $(ADMIN) \
		--network $(NETWORK) \
		--instruction-leeway 10000000 > $(CONTRACT_FILE)
	@echo "Contrato desplegado: $$(cat $(CONTRACT_FILE))"

# ============================================================================
# TRIP MANAGEMENT
# ============================================================================

# Variables por defecto para crear viaje
TARGET_AMOUNT ?= 10000000000
MIN_PARTICIPANTS ?= 2
DEADLINE ?= 9999999999
PENALTY_PERCENT ?= 10

.PHONY: create-trip
create-trip: ## Crear nuevo viaje (TARGET_AMOUNT, MIN_PARTICIPANTS, DEADLINE, PENALTY_PERCENT)
	@echo "Creando viaje..."
	@soroban contract invoke \
		--id $$(cat $(CONTRACT_FILE)) \
		--source $(ORGANIZER) \
		--network $(NETWORK) \
		-- create_trip \
		--organizer $$(soroban keys address $(ORGANIZER)) \
		--token $$(cat $(TOKEN_FILE)) \
		--target_amount $(TARGET_AMOUNT) \
		--min_participants $(MIN_PARTICIPANTS) \
		--deadline $(DEADLINE) \
		--penalty_percent $(PENALTY_PERCENT) | tee $(TRIP_FILE)
	@echo ""
	@echo "Viaje creado con ID: $$(cat $(TRIP_FILE))"

# Variable para trip_id (lee de archivo o usa el proporcionado)
TRIP_ID ?= $(shell cat $(TRIP_FILE) 2>/dev/null || echo 0)

# ============================================================================
# OPERACIONES
# ============================================================================

# Contribuir fondos
AMOUNT ?= 5000000000
PARTICIPANT ?= $(PARTICIPANT1)

.PHONY: contribute
contribute: ## Contribuir fondos (TRIP_ID, PARTICIPANT, AMOUNT)
	@echo "Contribuyendo $(AMOUNT) desde $(PARTICIPANT) al viaje $(TRIP_ID)..."
	@soroban contract invoke \
		--id $$(cat $(CONTRACT_FILE)) \
		--source $(PARTICIPANT) \
		--network $(NETWORK) \
		-- contribute \
		--trip_id $(TRIP_ID) \
		--participant $$(soroban keys address $(PARTICIPANT)) \
		--amount $(AMOUNT)
	@echo "Contribucion realizada"

.PHONY: contribute-p1
contribute-p1: ## Participante 1 contribuye (TRIP_ID, AMOUNT)
	@$(MAKE) contribute PARTICIPANT=$(PARTICIPANT1) AMOUNT=$(AMOUNT) TRIP_ID=$(TRIP_ID)

.PHONY: contribute-p2
contribute-p2: ## Participante 2 contribuye (TRIP_ID, AMOUNT)
	@$(MAKE) contribute PARTICIPANT=$(PARTICIPANT2) AMOUNT=$(AMOUNT) TRIP_ID=$(TRIP_ID)

.PHONY: withdraw
withdraw: ## Retirarse del viaje (TRIP_ID, PARTICIPANT)
	@echo "Retirando $(PARTICIPANT) del viaje $(TRIP_ID)..."
	@soroban contract invoke \
		--id $$(cat $(CONTRACT_FILE)) \
		--source $(PARTICIPANT) \
		--network $(NETWORK) \
		-- withdraw \
		--trip_id $(TRIP_ID) \
		--participant $$(soroban keys address $(PARTICIPANT))
	@echo "Retiro completado"

.PHONY: confirm-release
confirm-release: ## Participante confirma pago (TRIP_ID, PARTICIPANT)
	@echo "Confirmando release de $(PARTICIPANT) en viaje $(TRIP_ID)..."
	@soroban contract invoke \
		--id $$(cat $(CONTRACT_FILE)) \
		--source $(PARTICIPANT) \
		--network $(NETWORK) \
		-- confirm_release \
		--trip_id $(TRIP_ID) \
		--participant $$(soroban keys address $(PARTICIPANT))
	@echo "Confirmacion registrada"

.PHONY: confirm-p1
confirm-p1: ## Participante 1 confirma pago (TRIP_ID)
	@$(MAKE) confirm-release PARTICIPANT=$(PARTICIPANT1) TRIP_ID=$(TRIP_ID)

.PHONY: confirm-p2
confirm-p2: ## Participante 2 confirma pago (TRIP_ID)
	@$(MAKE) confirm-release PARTICIPANT=$(PARTICIPANT2) TRIP_ID=$(TRIP_ID)

.PHONY: release
release: ## Escape hatch: organizador fuerza pago (TRIP_ID)
	@echo "Liberando fondos del viaje $(TRIP_ID) (organizer escape hatch)..."
	@soroban contract invoke \
		--id $$(cat $(CONTRACT_FILE)) \
		--source $(ORGANIZER) \
		--network $(NETWORK) \
		-- release \
		--trip_id $(TRIP_ID)
	@echo "Fondos liberados"

.PHONY: cancel
cancel: ## Cancelar y reembolsar a todos (TRIP_ID)
	@echo "Cancelando viaje $(TRIP_ID)..."
	@soroban contract invoke \
		--id $$(cat $(CONTRACT_FILE)) \
		--source $(ORGANIZER) \
		--network $(NETWORK) \
		-- cancel \
		--trip_id $(TRIP_ID)
	@echo "Viaje cancelado, fondos reembolsados"

.PHONY: claim-deadline
claim-deadline: ## Reclamar deadline: refund si paso la fecha (TRIP_ID)
	@echo "Reclamando deadline del viaje $(TRIP_ID)..."
	@soroban contract invoke \
		--id $$(cat $(CONTRACT_FILE)) \
		--source $(ADMIN) \
		--network $(NETWORK) \
		-- claim_deadline \
		--trip_id $(TRIP_ID)
	@echo "Deadline reclamado, fondos reembolsados"

# ============================================================================
# CONSULTAS - CONTRATO
# ============================================================================

.PHONY: trip-count
trip-count: ## Ver numero total de viajes creados
	@echo "Total de viajes:"
	@soroban contract invoke \
		--id $$(cat $(CONTRACT_FILE)) \
		--source $(ADMIN) \
		--network $(NETWORK) \
		--send=no \
		-- get_trip_count

.PHONY: trips
trips: ## Ver lista de IDs de viajes
	@echo "Lista de viajes:"
	@soroban contract invoke \
		--id $$(cat $(CONTRACT_FILE)) \
		--source $(ADMIN) \
		--network $(NETWORK) \
		--send=no \
		-- get_trips

# ============================================================================
# CONSULTAS - VIAJE ESPECIFICO
# ============================================================================

.PHONY: trip
trip: ## Ver info completa del viaje (TRIP_ID)
	@echo "Info del viaje $(TRIP_ID):"
	@soroban contract invoke \
		--id $$(cat $(CONTRACT_FILE)) \
		--source $(ADMIN) \
		--network $(NETWORK) \
		--send=no \
		-- get_trip \
		--trip_id $(TRIP_ID)

.PHONY: state
state: ## Ver estado del viaje (TRIP_ID)
	@echo "Estado del viaje $(TRIP_ID):"
	@soroban contract invoke \
		--id $$(cat $(CONTRACT_FILE)) \
		--source $(ADMIN) \
		--network $(NETWORK) \
		--send=no \
		-- get_state \
		--trip_id $(TRIP_ID)

.PHONY: config
config: ## Ver configuracion del viaje (TRIP_ID)
	@echo "Configuracion del viaje $(TRIP_ID):"
	@soroban contract invoke \
		--id $$(cat $(CONTRACT_FILE)) \
		--source $(ADMIN) \
		--network $(NETWORK) \
		--send=no \
		-- get_config \
		--trip_id $(TRIP_ID)

.PHONY: participants
participants: ## Ver lista de participantes (TRIP_ID)
	@echo "Participantes del viaje $(TRIP_ID):"
	@soroban contract invoke \
		--id $$(cat $(CONTRACT_FILE)) \
		--source $(ADMIN) \
		--network $(NETWORK) \
		--send=no \
		-- get_participants \
		--trip_id $(TRIP_ID)

.PHONY: balance
balance: ## Ver balance de un participante (TRIP_ID, PARTICIPANT)
	@echo "Balance de $(PARTICIPANT) en viaje $(TRIP_ID):"
	@soroban contract invoke \
		--id $$(cat $(CONTRACT_FILE)) \
		--source $(ADMIN) \
		--network $(NETWORK) \
		--send=no \
		-- get_balance \
		--trip_id $(TRIP_ID) \
		--participant $$(soroban keys address $(PARTICIPANT))

.PHONY: balance-p1
balance-p1: ## Ver balance de participante 1 (TRIP_ID)
	@$(MAKE) balance PARTICIPANT=$(PARTICIPANT1) TRIP_ID=$(TRIP_ID)

.PHONY: balance-p2
balance-p2: ## Ver balance de participante 2 (TRIP_ID)
	@$(MAKE) balance PARTICIPANT=$(PARTICIPANT2) TRIP_ID=$(TRIP_ID)

.PHONY: recipients
recipients: ## Ver destinatarios de la factura (TRIP_ID)
	@echo "Destinatarios del viaje $(TRIP_ID):"
	@soroban contract invoke \
		--id $$(cat $(CONTRACT_FILE)) \
		--source $(ADMIN) \
		--network $(NETWORK) \
		--send=no \
		-- get_recipients \
		--trip_id $(TRIP_ID)

.PHONY: penalty
penalty: ## Ver penalty acumulada de un participante (TRIP_ID, PARTICIPANT)
	@echo "Penalty de $(PARTICIPANT) en viaje $(TRIP_ID):"
	@soroban contract invoke \
		--id $$(cat $(CONTRACT_FILE)) \
		--source $(ADMIN) \
		--network $(NETWORK) \
		--send=no \
		-- get_penalty \
		--trip_id $(TRIP_ID) \
		--participant $$(soroban keys address $(PARTICIPANT))

.PHONY: confirmation
confirmation: ## Ver si un participante confirmo release (TRIP_ID, PARTICIPANT)
	@echo "Confirmacion de $(PARTICIPANT) en viaje $(TRIP_ID):"
	@soroban contract invoke \
		--id $$(cat $(CONTRACT_FILE)) \
		--source $(ADMIN) \
		--network $(NETWORK) \
		--send=no \
		-- get_confirmation \
		--trip_id $(TRIP_ID) \
		--participant $$(soroban keys address $(PARTICIPANT))

# ============================================================================
# INFO
# ============================================================================

.PHONY: ids
ids: ## Mostrar IDs del contrato, token y viaje actual
	@echo "Contract ID: $$(cat $(CONTRACT_FILE) 2>/dev/null || echo 'No desplegado')"
	@echo "Token ID:    $$(cat $(TOKEN_FILE) 2>/dev/null || echo 'No configurado')"
	@echo "Trip ID:     $$(cat $(TRIP_FILE) 2>/dev/null || echo 'No creado')"

.PHONY: addresses
addresses: ## Mostrar direcciones de las identidades
	@echo "Admin:        $$(soroban keys address $(ADMIN) 2>/dev/null || echo 'No existe')"
	@echo "Organizer:    $$(soroban keys address $(ORGANIZER) 2>/dev/null || echo 'No existe')"
	@echo "Participant1: $$(soroban keys address $(PARTICIPANT1) 2>/dev/null || echo 'No existe')"
	@echo "Participant2: $$(soroban keys address $(PARTICIPANT2) 2>/dev/null || echo 'No existe')"

# ============================================================================
# FLUJOS COMPLETOS
# ============================================================================

.PHONY: demo
demo: setup deploy create-trip ## Demo: setup + deploy + crear viaje
	@echo ""
	@echo "======================================"
	@echo "Demo listo. Viaje ID: $$(cat $(TRIP_FILE))"
	@echo "Proximos pasos:"
	@echo "  make contribute-p1 AMOUNT=5000000000"
	@echo "  make contribute-p2 AMOUNT=5000000000"
	@echo "  make state"
	@echo "  make confirm-p1   # participante 1 confirma"
	@echo "  make confirm-p2   # participante 2 confirma → auto-pago"
	@echo "======================================"

.PHONY: demo-full
demo-full: demo ## Demo completo con contribuciones y release
	@echo ""
	@echo "Ejecutando flujo completo..."
	@$(MAKE) contribute-p1 AMOUNT=5000000000
	@$(MAKE) contribute-p2 AMOUNT=5000000000
	@$(MAKE) state
	@echo ""
	@echo "Escrow completado. Liberando fondos (organizer escape hatch)..."
	@$(MAKE) release
	@$(MAKE) state

.PHONY: demo-multi
demo-multi: setup deploy ## Demo con multiples viajes
	@echo ""
	@echo "Creando viaje 1 (meta: 10 XLM)..."
	@$(MAKE) create-trip TARGET_AMOUNT=10000000000 MIN_PARTICIPANTS=2
	@echo ""
	@echo "Creando viaje 2 (meta: 20 XLM)..."
	@$(MAKE) create-trip TARGET_AMOUNT=20000000000 MIN_PARTICIPANTS=1
	@echo ""
	@echo "Viajes creados:"
	@$(MAKE) trips
	@$(MAKE) trip-count

# ============================================================================
# HELP
# ============================================================================

.PHONY: help
help: ## Mostrar esta ayuda
	@echo "CoTravel Escrow (Multi-Trip) - Comandos disponibles:"
	@echo ""
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-15s\033[0m %s\n", $$1, $$2}'
	@echo ""
	@echo "Variables:"
	@echo "  TRIP_ID=<n>           ID del viaje (default: lee de .trip_id)"
	@echo "  AMOUNT=<stroops>      Monto en stroops (default: 5000000000)"
	@echo "  PARTICIPANT=<name>    Identidad (default: participant1)"
	@echo "  TARGET_AMOUNT=<n>     Meta del viaje (default: 10000000000)"
	@echo "  MIN_PARTICIPANTS=<n>  Minimo participantes (default: 2)"
	@echo "  PENALTY_PERCENT=<n>   % penalizacion (default: 10)"

.DEFAULT_GOAL := help
