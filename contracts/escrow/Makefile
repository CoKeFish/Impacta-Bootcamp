# ============================================================================
# CoTravel Escrow Contract - Makefile
# ============================================================================
# Uso: make <comando>
# Ejecutar dentro del contenedor: docker exec -it impacta-soroban-dev bash
# ============================================================================

# Configuración de red (usando RPC público de testnet)
NETWORK := testnet
RPC_URL := https://soroban-testnet.stellar.org
FRIENDBOT_URL := https://friendbot.stellar.org
NETWORK_PASSPHRASE := Test SDF Network ; September 2015

# Archivos
WASM := target/wasm32v1-none/release/cotravel_escrow.wasm
CONTRACT_FILE := .contract_id
TOKEN_FILE := .token_id

# Identidades (se crean automáticamente)
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

.PHONY: clean
clean: ## Limpiar artifacts
	cargo clean
	rm -f $(CONTRACT_FILE) $(TOKEN_FILE)

# ============================================================================
# SETUP - Configurar identidades y red
# ============================================================================

.PHONY: setup
setup: setup-network setup-identities setup-token ## Setup completo (red + identidades + token)
	@echo "✅ Setup completo"

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
	@echo "✅ Identidades creadas y fondeadas"

.PHONY: setup-token
setup-token: ## Obtener token nativo (XLM wrapper)
	@echo "Obteniendo ID del token nativo..."
	@soroban contract id asset --asset native --network $(NETWORK) > $(TOKEN_FILE)
	@echo "Token ID: $$(cat $(TOKEN_FILE))"
	@echo "✅ Token configurado (los participantes ya tienen XLM de friendbot)"

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
	@echo "✅ Contrato desplegado: $$(cat $(CONTRACT_FILE))"

# ============================================================================
# INITIALIZE
# ============================================================================

# Variables por defecto para inicialización
TARGET_AMOUNT ?= 10000000000
MIN_PARTICIPANTS ?= 2
DEADLINE ?= 9999999999
PENALTY_PERCENT ?= 10

.PHONY: init
init: ## Inicializar escrow (TARGET_AMOUNT, MIN_PARTICIPANTS, DEADLINE, PENALTY_PERCENT)
	@echo "Inicializando escrow..."
	@soroban contract invoke \
		--id $$(cat $(CONTRACT_FILE)) \
		--source $(ORGANIZER) \
		--network $(NETWORK) \
		-- initialize \
		--organizer $$(soroban keys address $(ORGANIZER)) \
		--token $$(cat $(TOKEN_FILE)) \
		--target_amount $(TARGET_AMOUNT) \
		--min_participants $(MIN_PARTICIPANTS) \
		--deadline $(DEADLINE) \
		--penalty_percent $(PENALTY_PERCENT)
	@echo "✅ Escrow inicializado"

# ============================================================================
# OPERACIONES
# ============================================================================

# Contribuir fondos
AMOUNT ?= 5000000000
PARTICIPANT ?= $(PARTICIPANT1)

.PHONY: contribute
contribute: ## Contribuir fondos (PARTICIPANT, AMOUNT)
	@echo "Contribuyendo $(AMOUNT) desde $(PARTICIPANT)..."
	@soroban contract invoke \
		--id $$(cat $(CONTRACT_FILE)) \
		--source $(PARTICIPANT) \
		--network $(NETWORK) \
		-- contribute \
		--participant $$(soroban keys address $(PARTICIPANT)) \
		--amount $(AMOUNT)
	@echo "✅ Contribución realizada"

.PHONY: contribute-p1
contribute-p1: ## Participante 1 contribuye (AMOUNT)
	@$(MAKE) contribute PARTICIPANT=$(PARTICIPANT1) AMOUNT=$(AMOUNT)

.PHONY: contribute-p2
contribute-p2: ## Participante 2 contribuye (AMOUNT)
	@$(MAKE) contribute PARTICIPANT=$(PARTICIPANT2) AMOUNT=$(AMOUNT)

.PHONY: withdraw
withdraw: ## Retirarse del escrow (PARTICIPANT)
	@echo "Retirando $(PARTICIPANT)..."
	@soroban contract invoke \
		--id $$(cat $(CONTRACT_FILE)) \
		--source $(PARTICIPANT) \
		--network $(NETWORK) \
		-- withdraw \
		--participant $$(soroban keys address $(PARTICIPANT))
	@echo "✅ Retiro completado"

.PHONY: release
release: ## Liberar fondos al organizador
	@echo "Liberando fondos..."
	@soroban contract invoke \
		--id $$(cat $(CONTRACT_FILE)) \
		--source $(ORGANIZER) \
		--network $(NETWORK) \
		-- release
	@echo "✅ Fondos liberados"

.PHONY: cancel
cancel: ## Cancelar y reembolsar a todos
	@echo "Cancelando escrow..."
	@soroban contract invoke \
		--id $$(cat $(CONTRACT_FILE)) \
		--source $(ORGANIZER) \
		--network $(NETWORK) \
		-- cancel
	@echo "✅ Escrow cancelado, fondos reembolsados"

# ============================================================================
# CONSULTAS
# ============================================================================

.PHONY: state
state: ## Ver estado del escrow
	@echo "Estado del escrow:"
	@soroban contract invoke \
		--id $$(cat $(CONTRACT_FILE)) \
		--source $(ADMIN) \
		--network $(NETWORK) \
		--send=no \
		-- get_state

.PHONY: config
config: ## Ver configuración del escrow
	@echo "Configuración:"
	@soroban contract invoke \
		--id $$(cat $(CONTRACT_FILE)) \
		--source $(ADMIN) \
		--network $(NETWORK) \
		--send=no \
		-- get_config

.PHONY: participants
participants: ## Ver lista de participantes
	@echo "Participantes:"
	@soroban contract invoke \
		--id $$(cat $(CONTRACT_FILE)) \
		--source $(ADMIN) \
		--network $(NETWORK) \
		--send=no \
		-- get_participants

.PHONY: balance
balance: ## Ver balance de un participante (PARTICIPANT)
	@echo "Balance de $(PARTICIPANT):"
	@soroban contract invoke \
		--id $$(cat $(CONTRACT_FILE)) \
		--source $(ADMIN) \
		--network $(NETWORK) \
		--send=no \
		-- get_balance \
		--participant $$(soroban keys address $(PARTICIPANT))

.PHONY: balance-p1
balance-p1: ## Ver balance de participante 1
	@$(MAKE) balance PARTICIPANT=$(PARTICIPANT1)

.PHONY: balance-p2
balance-p2: ## Ver balance de participante 2
	@$(MAKE) balance PARTICIPANT=$(PARTICIPANT2)

# ============================================================================
# INFO
# ============================================================================

.PHONY: ids
ids: ## Mostrar IDs del contrato y token
	@echo "Contract ID: $$(cat $(CONTRACT_FILE) 2>/dev/null || echo 'No desplegado')"
	@echo "Token ID:    $$(cat $(TOKEN_FILE) 2>/dev/null || echo 'No desplegado')"

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
demo: setup deploy init ## Demo: setup + deploy + init
	@echo ""
	@echo "======================================"
	@echo "Demo listo. Próximos pasos:"
	@echo "  make contribute-p1 AMOUNT=5000000000"
	@echo "  make contribute-p2 AMOUNT=6000000000"
	@echo "  make state"
	@echo "  make release"
	@echo "======================================"

.PHONY: demo-full
demo-full: demo ## Demo completo con contribuciones y release
	@echo ""
	@echo "Ejecutando flujo completo..."
	@$(MAKE) contribute-p1 AMOUNT=5000000000
	@$(MAKE) contribute-p2 AMOUNT=6000000000
	@$(MAKE) state
	@echo ""
	@echo "Escrow completado. Liberando fondos..."
	@$(MAKE) release
	@$(MAKE) state

# ============================================================================
# HELP
# ============================================================================

.PHONY: help
help: ## Mostrar esta ayuda
	@echo "CoTravel Escrow - Comandos disponibles:"
	@echo ""
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-15s\033[0m %s\n", $$1, $$2}'
	@echo ""
	@echo "Variables:"
	@echo "  AMOUNT=<stroops>      Monto en stroops (default: 5000000000)"
	@echo "  PARTICIPANT=<name>    Identidad (default: participant1)"
	@echo "  TARGET_AMOUNT=<n>     Meta del escrow (default: 10000000000)"
	@echo "  MIN_PARTICIPANTS=<n>  Mínimo participantes (default: 2)"
	@echo "  PENALTY_PERCENT=<n>   % penalización (default: 10)"

.DEFAULT_GOAL := help
