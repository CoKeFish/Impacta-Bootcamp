#![no_std]
// Audit notes (soroban-auditor warnings — acknowledged, mitigated, not bugs):
//
// [MEDIUM] dynamic_storage (22 warnings): Map/Vec in persistent storage is inherent to the
//   multi-pool design. Mitigated with hard caps: MAX_TRIPS, MAX_PARTICIPANTS, MAX_RECIPIENTS
//   prevent unbounded growth. Confirmations map bounded by MAX_PARTICIPANTS.
//
// [MEDIUM] avoid_vec_map_input (2 warnings): Vec<Recipient> input is fully validated (length cap,
//   positive amounts, sum == target_amount) before being stored. No unvalidated data reaches storage.
//
// [ENHANCEMENT] storage_change_events (9 warnings): All 9 public mutating functions emit events
//   via #[contractevent]. The auditor does not recognize the .publish(&env) pattern introduced in
//   SDK v25 / Protocol 23, so it reports false positives. create_trip delegates to create_invoice.

use soroban_sdk::{
    contract, contractevent, contractimpl, contracttype, symbol_short,
    token, Address, Env, Map, Symbol, Vec,
};

// Storage keys
const NEXT_TRIP_ID: Symbol = symbol_short!("NEXT_ID");
const TRIPS: Symbol = symbol_short!("TRIPS");

// Safety limits — prevent unbounded storage growth (mitigates dynamic_storage warnings)
const MAX_TRIPS: u64 = 10_000;
const MAX_PARTICIPANTS: u32 = 200;
const MAX_RECIPIENTS: u32 = 50;

// Trip-specific storage key helpers
#[contracttype]
#[derive(Clone)]
pub enum TripKey {
    Config(u64),
    State(u64),
    Balances(u64),
    Participants(u64),
    Recipients(u64),
    ContribVersions(u64),
    PenaltyPool(u64),
    Confirmations(u64),
}

// Status enum
#[contracttype]
#[derive(Clone, Copy, PartialEq, Eq, Debug)]
pub enum Status {
    Funding,
    Completed,
    Cancelled,
    Released,
}

// Recipient: a wallet that receives a portion of funds on release
#[contracttype]
#[derive(Clone, Debug)]
pub struct Recipient {
    pub address: Address,
    pub amount: i128,
}

// Configuration (immutable after creation, except recipients via update_recipients)
#[contracttype]
#[derive(Clone)]
pub struct Config {
    pub organizer: Address,
    pub token: Address,
    pub target_amount: i128,
    pub min_participants: u32,
    pub deadline: u64,
    pub penalty_percent: u32,
    pub auto_release: bool,
}

// Mutable state
#[contracttype]
#[derive(Clone)]
pub struct State {
    pub status: Status,
    pub total_collected: i128,
    pub participant_count: u32,
    pub version: u32,
    pub confirmation_count: u32,
}

// Trip info (for listing)
#[contracttype]
#[derive(Clone)]
pub struct TripInfo {
    pub trip_id: u64,
    pub organizer: Address,
    pub target_amount: i128,
    pub status: Status,
    pub total_collected: i128,
    pub participant_count: u32,
}

// Events (#[contractevent] replaces deprecated env.events().publish())
#[contractevent(topics = ["trip_new"])]
pub struct TripCreatedEvent {
    pub trip_id: u64,
    pub organizer: Address,
    pub target_amount: i128,
}

#[contractevent(topics = ["contrib"])]
pub struct ContributionEvent {
    pub trip_id: u64,
    pub participant: Address,
    pub amount: i128,
    pub new_balance: i128,
    pub total: i128,
}

#[contractevent(topics = ["withdraw"])]
pub struct WithdrawalEvent {
    pub trip_id: u64,
    pub participant: Address,
    pub refund: i128,
    pub penalty: i128,
}

#[contractevent(topics = ["released"])]
pub struct ReleasedEvent {
    pub trip_id: u64,
    pub organizer: Address,
    pub amount: i128,
}

#[contractevent(topics = ["cancel"])]
pub struct CancelledEvent {
    pub trip_id: u64,
    pub timestamp: u64,
}

#[contractevent(topics = ["inv_mod"])]
pub struct InvoiceModifiedEvent {
    pub trip_id: u64,
    pub version: u32,
}

#[contractevent(topics = ["confirm"])]
pub struct ConfirmReleaseEvent {
    pub trip_id: u64,
    pub participant: Address,
    pub confirmations: u32,
    pub required: u32,
}

#[contractevent(topics = ["deadline"])]
pub struct DeadlineExpiredEvent {
    pub trip_id: u64,
    pub timestamp: u64,
    pub refunded_participants: u32,
}

#[contract]
pub struct CotravelEscrow;

#[contractimpl]
impl CotravelEscrow {
    // ===== Trip / Invoice Management =====

    /// Create a new trip/invoice escrow, returns the trip_id.
    /// `recipients` is optional: if provided, sum(amounts) must equal target_amount.
    /// If empty, release sends all funds to the organizer (legacy behavior).
    pub fn create_invoice(
        env: Env,
        organizer: Address,
        token: Address,
        target_amount: i128,
        min_participants: u32,
        deadline: u64,
        penalty_percent: u32,
        recipients: Vec<Recipient>,
        auto_release: bool,
    ) -> u64 {
        organizer.require_auth();

        // Validate inputs
        if target_amount <= 0 {
            panic!("Target amount must be positive");
        }
        if min_participants == 0 {
            panic!("Min participants must be at least 1");
        }
        if penalty_percent > 100 {
            panic!("Penalty percent cannot exceed 100");
        }

        // Validate recipients if provided (length cap + content validation)
        if recipients.len() > MAX_RECIPIENTS {
            panic!("Too many recipients");
        }
        if !recipients.is_empty() {
            let mut sum: i128 = 0;
            for r in recipients.iter() {
                if r.amount <= 0 {
                    panic!("Recipient amount must be positive");
                }
                sum = sum.checked_add(r.amount).expect("Recipient sum overflow");
            }
            if sum != target_amount {
                panic!("Sum of recipient amounts must equal target amount");
            }
        }

        // Get and increment trip ID (bounded by MAX_TRIPS)
        let trip_id: u64 = env.storage().instance().get(&NEXT_TRIP_ID).unwrap_or(0);
        if trip_id >= MAX_TRIPS {
            panic!("Maximum number of trips reached");
        }
        let next_trip_id = trip_id.checked_add(1).expect("Trip ID overflow");
        env.storage().instance().set(&NEXT_TRIP_ID, &next_trip_id);

        // Store config
        let config = Config {
            organizer: organizer.clone(),
            token,
            target_amount,
            min_participants,
            deadline,
            penalty_percent,
            auto_release,
        };
        env.storage().persistent().set(&TripKey::Config(trip_id), &config);

        // Initialize state with version
        let state = State {
            status: Status::Funding,
            total_collected: 0,
            participant_count: 0,
            version: 0,
            confirmation_count: 0,
        };
        env.storage().persistent().set(&TripKey::State(trip_id), &state);

        // Initialize empty balances and participants
        let balances: Map<Address, i128> = Map::new(&env);
        let participants: Vec<Address> = Vec::new(&env);
        env.storage().persistent().set(&TripKey::Balances(trip_id), &balances);
        env.storage().persistent().set(&TripKey::Participants(trip_id), &participants);

        // Store recipients
        env.storage().persistent().set(&TripKey::Recipients(trip_id), &recipients);

        // Initialize contribution versions map
        let contrib_versions: Map<Address, u32> = Map::new(&env);
        env.storage().persistent().set(&TripKey::ContribVersions(trip_id), &contrib_versions);

        // Initialize empty penalty pool
        let penalty_pool: Map<Address, i128> = Map::new(&env);
        env.storage().persistent().set(&TripKey::PenaltyPool(trip_id), &penalty_pool);

        // Initialize empty confirmations map
        let confirmations: Map<Address, bool> = Map::new(&env);
        env.storage().persistent().set(&TripKey::Confirmations(trip_id), &confirmations);

        // Track trip in list
        let mut trips: Vec<u64> = env.storage().instance().get(&TRIPS).unwrap_or(Vec::new(&env));
        trips.push_back(trip_id);
        env.storage().instance().set(&TRIPS, &trips);

        // Emit event
        TripCreatedEvent {
            trip_id,
            organizer: organizer.clone(),
            target_amount,
        }
        .publish(&env);

        trip_id
    }

    /// Backwards-compatible create_trip (no recipients = all to organizer)
    pub fn create_trip(
        env: Env,
        organizer: Address,
        token: Address,
        target_amount: i128,
        min_participants: u32,
        deadline: u64,
        penalty_percent: u32,
    ) -> u64 {
        let empty_recipients: Vec<Recipient> = Vec::new(&env);
        Self::create_invoice(
            env,
            organizer,
            token,
            target_amount,
            min_participants,
            deadline,
            penalty_percent,
            empty_recipients,
            false, // legacy: manual release
        )
    }

    // ===== Operations =====

    /// Contribute funds to a trip escrow
    pub fn contribute(env: Env, trip_id: u64, participant: Address, amount: i128) {
        participant.require_auth();

        let config: Config = Self::get_config_internal(&env, trip_id);
        let mut state: State = Self::get_state_internal(&env, trip_id);

        // Validate
        if state.status != Status::Funding {
            panic!("Escrow is not accepting contributions");
        }
        if amount <= 0 {
            panic!("Amount must be positive");
        }
        if env.ledger().timestamp() > config.deadline {
            panic!("Deadline has passed");
        }

        // Block overfunding: reject if contribution would exceed target
        let projected = state.total_collected.checked_add(amount).expect("Total overflow");
        if projected > config.target_amount {
            panic!("Contribution would exceed target amount");
        }

        // Transfer tokens from participant to contract
        let token_client = token::Client::new(&env, &config.token);
        token_client.transfer(&participant, &env.current_contract_address(), &amount);

        // Update balances
        let mut balances: Map<Address, i128> = env.storage()
            .persistent()
            .get(&TripKey::Balances(trip_id))
            .unwrap_or_else(|| panic!("Balances not found for trip"));
        let current_balance = balances.try_get(participant.clone()).unwrap_or_default().unwrap_or(0);
        let new_balance = current_balance.checked_add(amount).expect("Balance overflow");
        balances.set(participant.clone(), new_balance);
        env.storage().persistent().set(&TripKey::Balances(trip_id), &balances);

        // Add to participants if new (bounded by MAX_PARTICIPANTS)
        if current_balance == 0 {
            if state.participant_count >= MAX_PARTICIPANTS {
                panic!("Maximum number of participants reached");
            }
            let mut participants: Vec<Address> = env.storage()
                .persistent()
                .get(&TripKey::Participants(trip_id))
                .unwrap_or_else(|| panic!("Participants not found for trip"));
            participants.push_back(participant.clone());
            env.storage().persistent().set(&TripKey::Participants(trip_id), &participants);
            state.participant_count = state.participant_count.checked_add(1).expect("Participant count overflow");
        }

        // Track contribution version
        let mut contrib_versions: Map<Address, u32> = env.storage()
            .persistent()
            .get(&TripKey::ContribVersions(trip_id))
            .unwrap_or(Map::new(&env));
        contrib_versions.set(participant.clone(), state.version);
        env.storage().persistent().set(&TripKey::ContribVersions(trip_id), &contrib_versions);

        // Update total
        state.total_collected = state.total_collected.checked_add(amount).expect("Total collected overflow");

        // Check if target reached
        if state.total_collected >= config.target_amount
            && state.participant_count >= config.min_participants
        {
            state.status = Status::Completed;
        }

        env.storage().persistent().set(&TripKey::State(trip_id), &state);

        // Emit contribution event
        ContributionEvent {
            trip_id,
            participant: participant.clone(),
            amount,
            new_balance,
            total: state.total_collected,
        }
        .publish(&env);

        // Auto-release: if pool just completed and auto_release is on, pay immediately
        if state.status == Status::Completed && config.auto_release {
            Self::release_internal(&env, trip_id, &config);
        }
    }

    /// Withdraw from escrow (with penalty, unless invoice was modified after contribution)
    pub fn withdraw(env: Env, trip_id: u64, participant: Address) {
        participant.require_auth();

        let config: Config = Self::get_config_internal(&env, trip_id);
        let mut state: State = Self::get_state_internal(&env, trip_id);

        if state.status != Status::Funding && state.status != Status::Completed {
            panic!("Cannot withdraw in current status");
        }

        let mut balances: Map<Address, i128> = env.storage()
            .persistent()
            .get(&TripKey::Balances(trip_id))
            .unwrap_or_else(|| panic!("Balances not found for trip"));
        let balance = balances.try_get(participant.clone()).unwrap_or_default().unwrap_or(0);

        if balance <= 0 {
            panic!("No balance to withdraw");
        }

        // Check if invoice was modified after this participant contributed → penalty-free opt-out
        let contrib_versions: Map<Address, u32> = env.storage()
            .persistent()
            .get(&TripKey::ContribVersions(trip_id))
            .unwrap_or(Map::new(&env));
        let contributed_at_version = contrib_versions.try_get(participant.clone()).unwrap_or_default().unwrap_or(0);
        let modified_after = state.version > contributed_at_version;

        // Calculate penalty (0 if modified after contribution)
        let penalty = if modified_after {
            0i128
        } else {
            balance.checked_mul(config.penalty_percent as i128)
                .expect("Penalty calculation overflow")
                / 100
        };
        let refund = balance.checked_sub(penalty).expect("Refund underflow");

        // Transfer refund to participant
        let token_client = token::Client::new(&env, &config.token);
        if refund > 0 {
            token_client.transfer(&env.current_contract_address(), &participant, &refund);
        }

        // Store penalty in pool (returned on cancel, forfeited on release)
        if penalty > 0 {
            let mut penalty_pool: Map<Address, i128> = env.storage()
                .persistent()
                .get(&TripKey::PenaltyPool(trip_id))
                .unwrap_or(Map::new(&env));
            let existing = penalty_pool.try_get(participant.clone()).unwrap_or_default().unwrap_or(0);
            penalty_pool.set(participant.clone(), existing.checked_add(penalty).expect("Penalty pool overflow"));
            env.storage().persistent().set(&TripKey::PenaltyPool(trip_id), &penalty_pool);
        }

        // Update participant balance and state
        balances.set(participant.clone(), 0);
        env.storage().persistent().set(&TripKey::Balances(trip_id), &balances);

        // Subtract only the refund (penalty stays counted in total_collected as pool funds)
        state.total_collected = state.total_collected.checked_sub(refund).expect("Total collected underflow");
        state.participant_count = state.participant_count.checked_sub(1).expect("Participant count underflow");

        // Remove confirmation if this participant had confirmed
        let mut confirmations: Map<Address, bool> = env.storage()
            .persistent()
            .get(&TripKey::Confirmations(trip_id))
            .unwrap_or(Map::new(&env));
        let was_confirmed = confirmations.try_get(participant.clone()).unwrap_or_default().unwrap_or(false);
        if was_confirmed {
            confirmations.set(participant.clone(), false);
            env.storage().persistent().set(&TripKey::Confirmations(trip_id), &confirmations);
            state.confirmation_count = state.confirmation_count.saturating_sub(1);
        }

        // Revert to Funding if no longer meets target
        if state.status == Status::Completed {
            if state.total_collected < config.target_amount
                || state.participant_count < config.min_participants
            {
                state.status = Status::Funding;
                // Reset all confirmations since pool state changed
                state.confirmation_count = 0;
                let empty_confirms: Map<Address, bool> = Map::new(&env);
                env.storage().persistent().set(&TripKey::Confirmations(trip_id), &empty_confirms);
            }
        }

        env.storage().persistent().set(&TripKey::State(trip_id), &state);

        // Emit event
        WithdrawalEvent {
            trip_id,
            participant: participant.clone(),
            refund,
            penalty,
        }
        .publish(&env);
    }

    /// Release funds: organizer-only escape hatch for manual release.
    /// Normal flow for non-auto pools is via confirm_release() by each participant.
    pub fn release(env: Env, trip_id: u64) {
        let config: Config = Self::get_config_internal(&env, trip_id);
        config.organizer.require_auth();

        let state: State = Self::get_state_internal(&env, trip_id);

        if state.status != Status::Completed {
            panic!("Cannot release: escrow not completed");
        }

        Self::release_internal(&env, trip_id, &config);
    }

    /// Cancel escrow and refund all participants (no penalty)
    pub fn cancel(env: Env, trip_id: u64) {
        let config: Config = Self::get_config_internal(&env, trip_id);
        config.organizer.require_auth();

        let mut state: State = Self::get_state_internal(&env, trip_id);

        if state.status == Status::Released || state.status == Status::Cancelled {
            panic!("Cannot cancel: already finalized");
        }

        // Refund all participants
        let token_client = token::Client::new(&env, &config.token);
        let balances: Map<Address, i128> = env.storage()
            .persistent()
            .get(&TripKey::Balances(trip_id))
            .unwrap_or_else(|| panic!("Balances not found for trip"));
        let participants: Vec<Address> = env.storage()
            .persistent()
            .get(&TripKey::Participants(trip_id))
            .unwrap_or_else(|| panic!("Participants not found for trip"));

        for participant in participants.iter() {
            let balance = balances.try_get(participant.clone()).unwrap_or_default().unwrap_or(0);
            if balance > 0 {
                token_client.transfer(&env.current_contract_address(), &participant, &balance);
            }
        }

        // Refund accumulated penalties (people who withdrew with penalty get it back on cancel)
        let penalty_pool: Map<Address, i128> = env.storage()
            .persistent()
            .get(&TripKey::PenaltyPool(trip_id))
            .unwrap_or(Map::new(&env));
        for key in penalty_pool.keys() {
            let penalty_amount = penalty_pool.try_get(key.clone()).unwrap_or_default().unwrap_or(0);
            if penalty_amount > 0 {
                token_client.transfer(&env.current_contract_address(), &key, &penalty_amount);
            }
        }

        // Update state
        state.status = Status::Cancelled;
        state.total_collected = 0;
        env.storage().persistent().set(&TripKey::State(trip_id), &state);

        // Clear balances and penalty pool
        let empty_balances: Map<Address, i128> = Map::new(&env);
        env.storage().persistent().set(&TripKey::Balances(trip_id), &empty_balances);
        let empty_penalties: Map<Address, i128> = Map::new(&env);
        env.storage().persistent().set(&TripKey::PenaltyPool(trip_id), &empty_penalties);

        // Emit event
        CancelledEvent {
            trip_id,
            timestamp: env.ledger().timestamp(),
        }
        .publish(&env);
    }

    /// Confirm release: participant consents to paying the invoice.
    /// When all active participants have confirmed, the contract auto-releases.
    /// Only callable when status == Completed and auto_release == false.
    pub fn confirm_release(env: Env, trip_id: u64, participant: Address) {
        participant.require_auth();

        let config: Config = Self::get_config_internal(&env, trip_id);
        let mut state: State = Self::get_state_internal(&env, trip_id);

        if state.status != Status::Completed {
            panic!("Pool is not in Completed status");
        }
        if config.auto_release {
            panic!("Pool uses auto-release; confirmation not needed");
        }

        // Verify participant has balance > 0 (is active)
        let balances: Map<Address, i128> = env.storage()
            .persistent()
            .get(&TripKey::Balances(trip_id))
            .unwrap_or(Map::new(&env));
        let balance = balances.try_get(participant.clone()).unwrap_or_default().unwrap_or(0);
        if balance <= 0 {
            panic!("Only active participants can confirm");
        }

        // Check not already confirmed
        let mut confirmations: Map<Address, bool> = env.storage()
            .persistent()
            .get(&TripKey::Confirmations(trip_id))
            .unwrap_or(Map::new(&env));
        let already = confirmations.try_get(participant.clone()).unwrap_or_default().unwrap_or(false);
        if already {
            panic!("Participant already confirmed");
        }

        // Record confirmation
        confirmations.set(participant.clone(), true);
        env.storage().persistent().set(&TripKey::Confirmations(trip_id), &confirmations);

        state.confirmation_count = state.confirmation_count.checked_add(1).expect("Confirmation count overflow");
        env.storage().persistent().set(&TripKey::State(trip_id), &state);

        // Emit event
        ConfirmReleaseEvent {
            trip_id,
            participant: participant.clone(),
            confirmations: state.confirmation_count,
            required: state.participant_count,
        }
        .publish(&env);

        // If all active participants confirmed → auto-release
        if state.confirmation_count >= state.participant_count {
            Self::release_internal(&env, trip_id, &config);
        }
    }

    /// Claim deadline: anyone can call this after the deadline to trigger full refund.
    /// No auth required — the backend (coTravel) or any user can trigger it.
    /// Refunds all active participants + accumulated penalties, like cancel().
    pub fn claim_deadline(env: Env, trip_id: u64) {
        let config: Config = Self::get_config_internal(&env, trip_id);
        let mut state: State = Self::get_state_internal(&env, trip_id);

        // Must be past deadline
        if env.ledger().timestamp() <= config.deadline {
            panic!("Deadline has not passed yet");
        }

        // Only works on pools still in Funding (not already completed/released/cancelled)
        if state.status != Status::Funding {
            panic!("Pool is not in Funding status");
        }

        // Refund all active participants
        let token_client = token::Client::new(&env, &config.token);
        let balances: Map<Address, i128> = env.storage()
            .persistent()
            .get(&TripKey::Balances(trip_id))
            .unwrap_or_else(|| panic!("Balances not found for trip"));
        let participants: Vec<Address> = env.storage()
            .persistent()
            .get(&TripKey::Participants(trip_id))
            .unwrap_or_else(|| panic!("Participants not found for trip"));

        for participant in participants.iter() {
            let balance = balances.try_get(participant.clone()).unwrap_or_default().unwrap_or(0);
            if balance > 0 {
                token_client.transfer(&env.current_contract_address(), &participant, &balance);
            }
        }

        // Refund accumulated penalties
        let penalty_pool: Map<Address, i128> = env.storage()
            .persistent()
            .get(&TripKey::PenaltyPool(trip_id))
            .unwrap_or(Map::new(&env));
        for key in penalty_pool.keys() {
            let penalty_amount = penalty_pool.try_get(key.clone()).unwrap_or_default().unwrap_or(0);
            if penalty_amount > 0 {
                token_client.transfer(&env.current_contract_address(), &key, &penalty_amount);
            }
        }

        let refunded = state.participant_count;

        // Update state
        state.status = Status::Cancelled;
        state.total_collected = 0;
        env.storage().persistent().set(&TripKey::State(trip_id), &state);

        // Clear balances and penalty pool
        let empty_balances: Map<Address, i128> = Map::new(&env);
        env.storage().persistent().set(&TripKey::Balances(trip_id), &empty_balances);
        let empty_penalties: Map<Address, i128> = Map::new(&env);
        env.storage().persistent().set(&TripKey::PenaltyPool(trip_id), &empty_penalties);

        // Emit event
        DeadlineExpiredEvent {
            trip_id,
            timestamp: env.ledger().timestamp(),
            refunded_participants: refunded,
        }
        .publish(&env);
    }

    /// Update recipients list (organizer only). Increments version for opt-out tracking.
    pub fn update_recipients(
        env: Env,
        trip_id: u64,
        new_recipients: Vec<Recipient>,
    ) {
        let config: Config = Self::get_config_internal(&env, trip_id);
        config.organizer.require_auth();

        let mut state: State = Self::get_state_internal(&env, trip_id);

        if state.status != Status::Funding && state.status != Status::Completed {
            panic!("Cannot update recipients in current status");
        }

        // Validate new recipients (length cap + content validation)
        if new_recipients.len() > MAX_RECIPIENTS {
            panic!("Too many recipients");
        }
        if !new_recipients.is_empty() {
            let mut sum: i128 = 0;
            for r in new_recipients.iter() {
                if r.amount <= 0 {
                    panic!("Recipient amount must be positive");
                }
                sum = sum.checked_add(r.amount).expect("Recipient sum overflow");
            }
            if sum != config.target_amount {
                panic!("Sum of recipient amounts must equal target amount");
            }
        }

        // Store new recipients
        env.storage().persistent().set(&TripKey::Recipients(trip_id), &new_recipients);

        // Increment version
        state.version = state.version.checked_add(1).expect("Version overflow");
        env.storage().persistent().set(&TripKey::State(trip_id), &state);

        // Emit event
        InvoiceModifiedEvent {
            trip_id,
            version: state.version,
        }
        .publish(&env);
    }

    // ===== View functions =====

    /// Get total number of trips created
    pub fn get_trip_count(env: Env) -> u64 {
        env.storage().instance().get(&NEXT_TRIP_ID).unwrap_or(0)
    }

    /// Get list of all trip IDs
    pub fn get_trips(env: Env) -> Vec<u64> {
        env.storage().instance().get(&TRIPS).unwrap_or(Vec::new(&env))
    }

    /// Get trip info (config + state summary)
    pub fn get_trip(env: Env, trip_id: u64) -> TripInfo {
        let config = Self::get_config_internal(&env, trip_id);
        let state = Self::get_state_internal(&env, trip_id);

        TripInfo {
            trip_id,
            organizer: config.organizer,
            target_amount: config.target_amount,
            status: state.status,
            total_collected: state.total_collected,
            participant_count: state.participant_count,
        }
    }

    /// Get trip configuration
    pub fn get_config(env: Env, trip_id: u64) -> Config {
        Self::get_config_internal(&env, trip_id)
    }

    /// Get trip state
    pub fn get_state(env: Env, trip_id: u64) -> State {
        Self::get_state_internal(&env, trip_id)
    }

    /// Get participant balance for a trip
    pub fn get_balance(env: Env, trip_id: u64, participant: Address) -> i128 {
        let balances: Map<Address, i128> = env.storage()
            .persistent()
            .get(&TripKey::Balances(trip_id))
            .unwrap_or(Map::new(&env));
        balances.try_get(participant).unwrap_or_default().unwrap_or(0)
    }

    /// Get all participants for a trip
    pub fn get_participants(env: Env, trip_id: u64) -> Vec<Address> {
        env.storage()
            .persistent()
            .get(&TripKey::Participants(trip_id))
            .unwrap_or(Vec::new(&env))
    }

    /// Get recipients for a trip
    pub fn get_recipients(env: Env, trip_id: u64) -> Vec<Recipient> {
        env.storage()
            .persistent()
            .get(&TripKey::Recipients(trip_id))
            .unwrap_or(Vec::new(&env))
    }

    /// Check if a participant has confirmed release
    pub fn get_confirmation(env: Env, trip_id: u64, participant: Address) -> bool {
        let confirmations: Map<Address, bool> = env.storage()
            .persistent()
            .get(&TripKey::Confirmations(trip_id))
            .unwrap_or(Map::new(&env));
        confirmations.try_get(participant).unwrap_or_default().unwrap_or(false)
    }

    /// Get accumulated penalty for a participant (from previous withdrawals)
    pub fn get_penalty(env: Env, trip_id: u64, participant: Address) -> i128 {
        let penalty_pool: Map<Address, i128> = env.storage()
            .persistent()
            .get(&TripKey::PenaltyPool(trip_id))
            .unwrap_or(Map::new(&env));
        penalty_pool.try_get(participant).unwrap_or_default().unwrap_or(0)
    }

    // ===== Internal helpers =====

    /// Internal release logic (no auth check). Used by both release() and auto-release in contribute().
    fn release_internal(env: &Env, trip_id: u64, config: &Config) {
        let mut state: State = Self::get_state_internal(env, trip_id);

        let token_client = token::Client::new(env, &config.token);
        let amount = state.total_collected;

        // Check if recipients exist
        let recipients: Vec<Recipient> = env.storage()
            .persistent()
            .get(&TripKey::Recipients(trip_id))
            .unwrap_or(Vec::new(env));

        if recipients.is_empty() {
            // Legacy behavior: send all to organizer
            token_client.transfer(&env.current_contract_address(), &config.organizer, &amount);
        } else {
            // Distribute to each recipient according to their amount
            for r in recipients.iter() {
                token_client.transfer(&env.current_contract_address(), &r.address, &r.amount);
            }
            // Any remaining funds (from accumulated penalties) also go to recipients' invoice
            // Since we block overfunding, remainder is only from penalties that filled part of the target
            let remainder = amount.checked_sub(config.target_amount).expect("Remainder underflow");
            if remainder > 0 {
                // Penalty surplus beyond target: send to organizer
                token_client.transfer(&env.current_contract_address(), &config.organizer, &remainder);
            }
        }

        state.status = Status::Released;
        state.total_collected = 0;
        env.storage().persistent().set(&TripKey::State(trip_id), &state);

        // Clear balances
        let empty_balances: Map<Address, i128> = Map::new(env);
        env.storage().persistent().set(&TripKey::Balances(trip_id), &empty_balances);

        // Clear penalty pool (penalties forfeited — they went toward paying the invoice)
        let empty_penalties: Map<Address, i128> = Map::new(env);
        env.storage().persistent().set(&TripKey::PenaltyPool(trip_id), &empty_penalties);

        // Emit event
        ReleasedEvent {
            trip_id,
            organizer: config.organizer.clone(),
            amount,
        }
        .publish(env);
    }

    fn get_config_internal(env: &Env, trip_id: u64) -> Config {
        env.storage()
            .persistent()
            .get(&TripKey::Config(trip_id))
            .unwrap_or_else(|| panic!("Trip not found"))
    }

    fn get_state_internal(env: &Env, trip_id: u64) -> State {
        env.storage()
            .persistent()
            .get(&TripKey::State(trip_id))
            .unwrap_or_else(|| panic!("Trip not found"))
    }
}

mod test;
