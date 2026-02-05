#![cfg(test)]

use super::*;
use soroban_sdk::{
    testutils::{Address as _, Ledger},
    token::{StellarAssetClient, TokenClient},
    Env,
};

fn create_token_contract<'a>(env: &Env, admin: &Address) -> (TokenClient<'a>, StellarAssetClient<'a>) {
    let contract_address = env.register_stellar_asset_contract_v2(admin.clone());
    (
        TokenClient::new(env, &contract_address.address()),
        StellarAssetClient::new(env, &contract_address.address()),
    )
}

#[test]
fn test_initialize() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let organizer = Address::generate(&env);

    let (_, token_admin) = create_token_contract(&env, &admin);
    let token_address = token_admin.address.clone();

    let contract_id = env.register(CotravelEscrow, ());
    let client = CotravelEscrowClient::new(&env, &contract_id);

    env.ledger().set_timestamp(1000);

    client.initialize(
        &organizer,
        &token_address,
        &1_000_000,
        &2,
        &2000,
        &10,
    );

    let config = client.get_config();
    assert_eq!(config.organizer, organizer);
    assert_eq!(config.target_amount, 1_000_000);
    assert_eq!(config.min_participants, 2);
    assert_eq!(config.penalty_percent, 10);

    let state = client.get_state();
    assert_eq!(state.status, Status::Funding);
    assert_eq!(state.total_collected, 0);
    assert_eq!(state.participant_count, 0);
}

#[test]
fn test_contribute() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let organizer = Address::generate(&env);
    let participant1 = Address::generate(&env);
    let participant2 = Address::generate(&env);

    let (token_client, token_admin) = create_token_contract(&env, &admin);
    let token_address = token_admin.address.clone();

    // Mint tokens
    token_admin.mint(&participant1, &10_000_000);
    token_admin.mint(&participant2, &10_000_000);

    let contract_id = env.register(CotravelEscrow, ());
    let client = CotravelEscrowClient::new(&env, &contract_id);

    env.ledger().set_timestamp(1000);

    client.initialize(
        &organizer,
        &token_address,
        &1_000_000,
        &2,
        &2000,
        &10,
    );

    // Participant 1 contributes
    client.contribute(&participant1, &500_000);

    assert_eq!(client.get_balance(&participant1), 500_000);
    assert_eq!(client.get_state().total_collected, 500_000);
    assert_eq!(client.get_state().participant_count, 1);
    assert_eq!(client.get_state().status, Status::Funding);

    // Participant 2 contributes - should complete
    client.contribute(&participant2, &600_000);

    assert_eq!(client.get_balance(&participant2), 600_000);
    assert_eq!(client.get_state().total_collected, 1_100_000);
    assert_eq!(client.get_state().participant_count, 2);
    assert_eq!(client.get_state().status, Status::Completed);
}

#[test]
fn test_withdraw_with_penalty() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let organizer = Address::generate(&env);
    let participant1 = Address::generate(&env);
    let participant2 = Address::generate(&env);

    let (token_client, token_admin) = create_token_contract(&env, &admin);
    let token_address = token_admin.address.clone();

    token_admin.mint(&participant1, &10_000_000);
    token_admin.mint(&participant2, &10_000_000);

    let contract_id = env.register(CotravelEscrow, ());
    let client = CotravelEscrowClient::new(&env, &contract_id);

    env.ledger().set_timestamp(1000);

    client.initialize(
        &organizer,
        &token_address,
        &1_000_000,
        &2,
        &2000,
        &10,
    );

    let initial_balance = token_client.balance(&participant1);

    client.contribute(&participant1, &500_000);
    client.contribute(&participant2, &500_000);

    client.withdraw(&participant1);

    let final_balance = token_client.balance(&participant1);
    assert_eq!(final_balance, initial_balance - 50_000);
    assert_eq!(client.get_balance(&participant2), 550_000);
}

#[test]
fn test_release() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let organizer = Address::generate(&env);
    let participant1 = Address::generate(&env);
    let participant2 = Address::generate(&env);

    let (token_client, token_admin) = create_token_contract(&env, &admin);
    let token_address = token_admin.address.clone();

    token_admin.mint(&participant1, &10_000_000);
    token_admin.mint(&participant2, &10_000_000);

    let contract_id = env.register(CotravelEscrow, ());
    let client = CotravelEscrowClient::new(&env, &contract_id);

    env.ledger().set_timestamp(1000);

    client.initialize(
        &organizer,
        &token_address,
        &1_000_000,
        &2,
        &2000,
        &10,
    );

    client.contribute(&participant1, &500_000);
    client.contribute(&participant2, &600_000);

    assert_eq!(client.get_state().status, Status::Completed);

    let organizer_balance_before = token_client.balance(&organizer);

    client.release();

    assert_eq!(client.get_state().status, Status::Released);
    assert_eq!(client.get_state().total_collected, 0);

    let organizer_balance_after = token_client.balance(&organizer);
    assert_eq!(organizer_balance_after - organizer_balance_before, 1_100_000);
}

#[test]
fn test_cancel() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let organizer = Address::generate(&env);
    let participant1 = Address::generate(&env);
    let participant2 = Address::generate(&env);

    let (token_client, token_admin) = create_token_contract(&env, &admin);
    let token_address = token_admin.address.clone();

    token_admin.mint(&participant1, &10_000_000);
    token_admin.mint(&participant2, &10_000_000);

    let contract_id = env.register(CotravelEscrow, ());
    let client = CotravelEscrowClient::new(&env, &contract_id);

    env.ledger().set_timestamp(1000);

    client.initialize(
        &organizer,
        &token_address,
        &1_000_000,
        &2,
        &2000,
        &10,
    );

    let p1_initial = token_client.balance(&participant1);
    let p2_initial = token_client.balance(&participant2);

    client.contribute(&participant1, &300_000);
    client.contribute(&participant2, &200_000);

    client.cancel();

    assert_eq!(client.get_state().status, Status::Cancelled);
    assert_eq!(token_client.balance(&participant1), p1_initial);
    assert_eq!(token_client.balance(&participant2), p2_initial);
}
