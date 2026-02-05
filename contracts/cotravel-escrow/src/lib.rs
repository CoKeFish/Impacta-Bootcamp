#![no_std]

use soroban_sdk::{
    contract, contractimpl, contracttype, symbol_short,
    token, Address, Env, Map, Symbol, Vec,
};

// Storage keys
const NEXT_TRIP_ID: Symbol = symbol_short!("NEXT_ID");
const TRIPS: Symbol = symbol_short!("TRIPS");

// Trip-specific storage key helpers
#[contracttype]
#[derive(Clone)]
pub enum TripKey {
    Config(u64),
    State(u64),
    Balances(u64),
    Participants(u64),
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

// Configuration (immutable after creation)
#[contracttype]
#[derive(Clone)]
pub struct Config {
    pub organizer: Address,
    pub token: Address,
    pub target_amount: i128,
    pub min_participants: u32,
    pub deadline: u64,
    pub penalty_percent: u32,
}

// Mutable state
#[contracttype]
#[derive(Clone)]
pub struct State {
    pub status: Status,
    pub total_collected: i128,
    pub participant_count: u32,
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

// Events
#[contracttype]
#[derive(Clone)]
pub struct TripCreatedEvent {
    pub trip_id: u64,
    pub organizer: Address,
    pub target_amount: i128,
}

#[contracttype]
#[derive(Clone)]
pub struct ContributionEvent {
    pub trip_id: u64,
    pub participant: Address,
    pub amount: i128,
    pub new_balance: i128,
    pub total: i128,
}

#[contracttype]
#[derive(Clone)]
pub struct WithdrawalEvent {
    pub trip_id: u64,
    pub participant: Address,
    pub refund: i128,
    pub penalty: i128,
}

#[contracttype]
#[derive(Clone)]
pub struct ReleasedEvent {
    pub trip_id: u64,
    pub organizer: Address,
    pub amount: i128,
}

#[contracttype]
#[derive(Clone)]
pub struct CancelledEvent {
    pub trip_id: u64,
    pub timestamp: u64,
}

#[contract]
pub struct CotravelEscrow;

#[contractimpl]
impl CotravelEscrow {
    // ===== Trip Management =====

    /// Create a new trip escrow, returns the trip_id
    pub fn create_trip(
        env: Env,
        organizer: Address,
        token: Address,
        target_amount: i128,
        min_participants: u32,
        deadline: u64,
        penalty_percent: u32,
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

        // Get and increment trip ID
        let trip_id: u64 = env.storage().instance().get(&NEXT_TRIP_ID).unwrap_or(0);
        env.storage().instance().set(&NEXT_TRIP_ID, &(trip_id + 1));

        // Store config
        let config = Config {
            organizer: organizer.clone(),
            token,
            target_amount,
            min_participants,
            deadline,
            penalty_percent,
        };
        env.storage().persistent().set(&TripKey::Config(trip_id), &config);

        // Initialize state
        let state = State {
            status: Status::Funding,
            total_collected: 0,
            participant_count: 0,
        };
        env.storage().persistent().set(&TripKey::State(trip_id), &state);

        // Initialize empty balances and participants
        let balances: Map<Address, i128> = Map::new(&env);
        let participants: Vec<Address> = Vec::new(&env);
        env.storage().persistent().set(&TripKey::Balances(trip_id), &balances);
        env.storage().persistent().set(&TripKey::Participants(trip_id), &participants);

        // Track trip in list
        let mut trips: Vec<u64> = env.storage().instance().get(&TRIPS).unwrap_or(Vec::new(&env));
        trips.push_back(trip_id);
        env.storage().instance().set(&TRIPS, &trips);

        // Emit event
        env.events().publish(
            (symbol_short!("trip_new"),),
            TripCreatedEvent {
                trip_id,
                organizer,
                target_amount,
            },
        );

        trip_id
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

        // Transfer tokens from participant to contract
        let token_client = token::Client::new(&env, &config.token);
        token_client.transfer(&participant, &env.current_contract_address(), &amount);

        // Update balances
        let mut balances: Map<Address, i128> = env.storage()
            .persistent()
            .get(&TripKey::Balances(trip_id))
            .unwrap();
        let current_balance = balances.get(participant.clone()).unwrap_or(0);
        let new_balance = current_balance + amount;
        balances.set(participant.clone(), new_balance);
        env.storage().persistent().set(&TripKey::Balances(trip_id), &balances);

        // Add to participants if new
        if current_balance == 0 {
            let mut participants: Vec<Address> = env.storage()
                .persistent()
                .get(&TripKey::Participants(trip_id))
                .unwrap();
            participants.push_back(participant.clone());
            env.storage().persistent().set(&TripKey::Participants(trip_id), &participants);
            state.participant_count += 1;
        }

        // Update total
        state.total_collected += amount;

        // Check if target reached
        if state.total_collected >= config.target_amount
            && state.participant_count >= config.min_participants
        {
            state.status = Status::Completed;
        }

        env.storage().persistent().set(&TripKey::State(trip_id), &state);

        // Emit event
        env.events().publish(
            (symbol_short!("contrib"),),
            ContributionEvent {
                trip_id,
                participant,
                amount,
                new_balance,
                total: state.total_collected,
            },
        );
    }

    /// Withdraw from escrow (with penalty)
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
            .unwrap();
        let balance = balances.get(participant.clone()).unwrap_or(0);

        if balance <= 0 {
            panic!("No balance to withdraw");
        }

        // Calculate penalty
        let penalty = (balance * config.penalty_percent as i128) / 100;
        let refund = balance - penalty;

        // Transfer refund to participant
        let token_client = token::Client::new(&env, &config.token);
        if refund > 0 {
            token_client.transfer(&env.current_contract_address(), &participant, &refund);
        }

        // Redistribute penalty to remaining participants
        if penalty > 0 {
            let participants: Vec<Address> = env.storage()
                .persistent()
                .get(&TripKey::Participants(trip_id))
                .unwrap();
            let remaining_count = state.participant_count - 1;

            if remaining_count > 0 {
                let share = penalty / remaining_count as i128;
                for p in participants.iter() {
                    if p != participant {
                        let p_balance = balances.get(p.clone()).unwrap_or(0);
                        if p_balance > 0 {
                            balances.set(p.clone(), p_balance + share);
                        }
                    }
                }
            }
        }

        // Update participant balance and state
        balances.set(participant.clone(), 0);
        env.storage().persistent().set(&TripKey::Balances(trip_id), &balances);

        state.total_collected -= balance;
        state.participant_count -= 1;

        // Revert to Funding if no longer meets target
        if state.status == Status::Completed {
            if state.total_collected < config.target_amount
                || state.participant_count < config.min_participants
            {
                state.status = Status::Funding;
            }
        }

        env.storage().persistent().set(&TripKey::State(trip_id), &state);

        // Emit event
        env.events().publish(
            (symbol_short!("withdraw"),),
            WithdrawalEvent {
                trip_id,
                participant,
                refund,
                penalty,
            },
        );
    }

    /// Release funds to organizer (only when Completed)
    pub fn release(env: Env, trip_id: u64) {
        let config: Config = Self::get_config_internal(&env, trip_id);
        config.organizer.require_auth();

        let mut state: State = Self::get_state_internal(&env, trip_id);

        if state.status != Status::Completed {
            panic!("Cannot release: escrow not completed");
        }

        // Transfer all funds to organizer
        let token_client = token::Client::new(&env, &config.token);
        let amount = state.total_collected;
        token_client.transfer(&env.current_contract_address(), &config.organizer, &amount);

        state.status = Status::Released;
        state.total_collected = 0;
        env.storage().persistent().set(&TripKey::State(trip_id), &state);

        // Clear balances
        let balances: Map<Address, i128> = Map::new(&env);
        env.storage().persistent().set(&TripKey::Balances(trip_id), &balances);

        // Emit event
        env.events().publish(
            (symbol_short!("released"),),
            ReleasedEvent {
                trip_id,
                organizer: config.organizer,
                amount,
            },
        );
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
            .unwrap();
        let participants: Vec<Address> = env.storage()
            .persistent()
            .get(&TripKey::Participants(trip_id))
            .unwrap();

        for participant in participants.iter() {
            let balance = balances.get(participant.clone()).unwrap_or(0);
            if balance > 0 {
                token_client.transfer(&env.current_contract_address(), &participant, &balance);
            }
        }

        // Update state
        state.status = Status::Cancelled;
        state.total_collected = 0;
        env.storage().persistent().set(&TripKey::State(trip_id), &state);

        // Clear balances
        let empty_balances: Map<Address, i128> = Map::new(&env);
        env.storage().persistent().set(&TripKey::Balances(trip_id), &empty_balances);

        // Emit event
        env.events().publish(
            (symbol_short!("cancel"),),
            CancelledEvent {
                trip_id,
                timestamp: env.ledger().timestamp(),
            },
        );
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
        balances.get(participant).unwrap_or(0)
    }

    /// Get all participants for a trip
    pub fn get_participants(env: Env, trip_id: u64) -> Vec<Address> {
        env.storage()
            .persistent()
            .get(&TripKey::Participants(trip_id))
            .unwrap_or(Vec::new(&env))
    }

    // ===== Internal helpers =====

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
