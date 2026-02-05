#![no_std]

use soroban_sdk::{
    contract, contractimpl, contracttype, symbol_short,
    token, Address, Env, Map, Symbol, Vec,
};

// Storage keys
const CONFIG: Symbol = symbol_short!("CONFIG");
const STATE: Symbol = symbol_short!("STATE");
const BALANCES: Symbol = symbol_short!("BALANCES");
const PARTICIPANTS: Symbol = symbol_short!("PARTICIP");

// Status enum
#[contracttype]
#[derive(Clone, Copy, PartialEq, Eq, Debug)]
pub enum Status {
    Created,
    Funding,
    Completed,
    Cancelled,
    Released,
}

// Configuration (immutable after init)
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

// Events
#[contracttype]
#[derive(Clone)]
pub struct ContributionEvent {
    pub participant: Address,
    pub amount: i128,
    pub new_balance: i128,
    pub total: i128,
}

#[contracttype]
#[derive(Clone)]
pub struct WithdrawalEvent {
    pub participant: Address,
    pub refund: i128,
    pub penalty: i128,
}

#[contracttype]
#[derive(Clone)]
pub struct ReleasedEvent {
    pub organizer: Address,
    pub amount: i128,
}

#[contract]
pub struct CotravelEscrow;

#[contractimpl]
impl CotravelEscrow {
    /// Initialize the escrow contract
    pub fn initialize(
        env: Env,
        organizer: Address,
        token: Address,
        target_amount: i128,
        min_participants: u32,
        deadline: u64,
        penalty_percent: u32,
    ) {
        // Ensure not already initialized
        if env.storage().instance().has(&CONFIG) {
            panic!("Already initialized");
        }

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

        // Store config (immutable)
        let config = Config {
            organizer,
            token,
            target_amount,
            min_participants,
            deadline,
            penalty_percent,
        };
        env.storage().instance().set(&CONFIG, &config);

        // Initialize state
        let state = State {
            status: Status::Funding,
            total_collected: 0,
            participant_count: 0,
        };
        env.storage().persistent().set(&STATE, &state);

        // Initialize empty balances and participants
        let balances: Map<Address, i128> = Map::new(&env);
        let participants: Vec<Address> = Vec::new(&env);
        env.storage().persistent().set(&BALANCES, &balances);
        env.storage().persistent().set(&PARTICIPANTS, &participants);
    }

    /// Contribute funds to the escrow
    pub fn contribute(env: Env, participant: Address, amount: i128) {
        participant.require_auth();

        let config: Config = env.storage().instance().get(&CONFIG).unwrap();
        let mut state: State = env.storage().persistent().get(&STATE).unwrap();

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
        let mut balances: Map<Address, i128> = env.storage().persistent().get(&BALANCES).unwrap();
        let current_balance = balances.get(participant.clone()).unwrap_or(0);
        let new_balance = current_balance + amount;
        balances.set(participant.clone(), new_balance);
        env.storage().persistent().set(&BALANCES, &balances);

        // Add to participants if new
        if current_balance == 0 {
            let mut participants: Vec<Address> = env.storage().persistent().get(&PARTICIPANTS).unwrap();
            participants.push_back(participant.clone());
            env.storage().persistent().set(&PARTICIPANTS, &participants);
            state.participant_count += 1;
        }

        // Update total
        state.total_collected += amount;

        // Check if target reached
        if state.total_collected >= config.target_amount
            && state.participant_count >= config.min_participants {
            state.status = Status::Completed;
        }

        env.storage().persistent().set(&STATE, &state);

        // Emit event
        env.events().publish(
            (symbol_short!("contrib"),),
            ContributionEvent {
                participant,
                amount,
                new_balance,
                total: state.total_collected,
            },
        );
    }

    /// Withdraw from escrow (with penalty)
    pub fn withdraw(env: Env, participant: Address) {
        participant.require_auth();

        let config: Config = env.storage().instance().get(&CONFIG).unwrap();
        let mut state: State = env.storage().persistent().get(&STATE).unwrap();

        if state.status != Status::Funding && state.status != Status::Completed {
            panic!("Cannot withdraw in current status");
        }

        let mut balances: Map<Address, i128> = env.storage().persistent().get(&BALANCES).unwrap();
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
            let participants: Vec<Address> = env.storage().persistent().get(&PARTICIPANTS).unwrap();
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
        env.storage().persistent().set(&BALANCES, &balances);

        state.total_collected -= balance;
        state.participant_count -= 1;

        // Revert to Funding if no longer meets target
        if state.status == Status::Completed {
            if state.total_collected < config.target_amount
                || state.participant_count < config.min_participants {
                state.status = Status::Funding;
            }
        }

        env.storage().persistent().set(&STATE, &state);

        // Emit event
        env.events().publish(
            (symbol_short!("withdraw"),),
            WithdrawalEvent {
                participant,
                refund,
                penalty,
            },
        );
    }

    /// Release funds to organizer (only when Completed)
    pub fn release(env: Env) {
        let config: Config = env.storage().instance().get(&CONFIG).unwrap();
        config.organizer.require_auth();

        let mut state: State = env.storage().persistent().get(&STATE).unwrap();

        if state.status != Status::Completed {
            panic!("Cannot release: escrow not completed");
        }

        // Transfer all funds to organizer
        let token_client = token::Client::new(&env, &config.token);
        let amount = state.total_collected;
        token_client.transfer(&env.current_contract_address(), &config.organizer, &amount);

        state.status = Status::Released;
        state.total_collected = 0;
        env.storage().persistent().set(&STATE, &state);

        // Clear balances
        let balances: Map<Address, i128> = Map::new(&env);
        env.storage().persistent().set(&BALANCES, &balances);

        // Emit event
        env.events().publish(
            (symbol_short!("released"),),
            ReleasedEvent {
                organizer: config.organizer,
                amount,
            },
        );
    }

    /// Cancel escrow and refund all participants (no penalty)
    pub fn cancel(env: Env) {
        let config: Config = env.storage().instance().get(&CONFIG).unwrap();
        config.organizer.require_auth();

        let mut state: State = env.storage().persistent().get(&STATE).unwrap();

        if state.status == Status::Released || state.status == Status::Cancelled {
            panic!("Cannot cancel: already finalized");
        }

        // Refund all participants
        let token_client = token::Client::new(&env, &config.token);
        let balances: Map<Address, i128> = env.storage().persistent().get(&BALANCES).unwrap();
        let participants: Vec<Address> = env.storage().persistent().get(&PARTICIPANTS).unwrap();

        for participant in participants.iter() {
            let balance = balances.get(participant.clone()).unwrap_or(0);
            if balance > 0 {
                token_client.transfer(&env.current_contract_address(), &participant, &balance);
            }
        }

        // Update state
        state.status = Status::Cancelled;
        state.total_collected = 0;
        env.storage().persistent().set(&STATE, &state);

        // Clear balances
        let empty_balances: Map<Address, i128> = Map::new(&env);
        env.storage().persistent().set(&BALANCES, &empty_balances);

        // Emit event
        env.events().publish(
            (symbol_short!("cancel"),),
            env.ledger().timestamp(),
        );
    }

    // ===== View functions =====

    pub fn get_config(env: Env) -> Config {
        env.storage().instance().get(&CONFIG).unwrap()
    }

    pub fn get_state(env: Env) -> State {
        env.storage().persistent().get(&STATE).unwrap()
    }

    pub fn get_balance(env: Env, participant: Address) -> i128 {
        let balances: Map<Address, i128> = env.storage().persistent().get(&BALANCES).unwrap();
        balances.get(participant).unwrap_or(0)
    }

    pub fn get_participants(env: Env) -> Vec<Address> {
        env.storage().persistent().get(&PARTICIPANTS).unwrap()
    }
}

mod test;
