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
fn test_create_trip() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let organizer = Address::generate(&env);

    let (_, token_admin) = create_token_contract(&env, &admin);
    let token_address = token_admin.address.clone();

    let contract_id = env.register(CotravelEscrow, ());
    let client = CotravelEscrowClient::new(&env, &contract_id);

    env.ledger().set_timestamp(1000);

    // Create first trip
    let trip_id = client.create_trip(
        &organizer,
        &token_address,
        &1_000_000,
        &2,
        &2000,
        &10,
    );

    assert_eq!(trip_id, 0);
    assert_eq!(client.get_trip_count(), 1);

    let config = client.get_config(&trip_id);
    assert_eq!(config.organizer, organizer);
    assert_eq!(config.target_amount, 1_000_000);
    assert_eq!(config.min_participants, 2);
    assert_eq!(config.penalty_percent, 10);

    let state = client.get_state(&trip_id);
    assert_eq!(state.status, Status::Funding);
    assert_eq!(state.total_collected, 0);
    assert_eq!(state.participant_count, 0);

    // Create second trip
    let trip_id2 = client.create_trip(
        &organizer,
        &token_address,
        &2_000_000,
        &3,
        &3000,
        &5,
    );

    assert_eq!(trip_id2, 1);
    assert_eq!(client.get_trip_count(), 2);

    let trips = client.get_trips();
    assert_eq!(trips.len(), 2);
    assert_eq!(trips.get(0).unwrap(), 0);
    assert_eq!(trips.get(1).unwrap(), 1);
}

#[test]
fn test_contribute() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let organizer = Address::generate(&env);
    let participant1 = Address::generate(&env);
    let participant2 = Address::generate(&env);

    let (_, token_admin) = create_token_contract(&env, &admin);
    let token_address = token_admin.address.clone();

    // Mint tokens
    token_admin.mint(&participant1, &10_000_000);
    token_admin.mint(&participant2, &10_000_000);

    let contract_id = env.register(CotravelEscrow, ());
    let client = CotravelEscrowClient::new(&env, &contract_id);

    env.ledger().set_timestamp(1000);

    let trip_id = client.create_trip(
        &organizer,
        &token_address,
        &1_000_000,
        &2,
        &2000,
        &10,
    );

    // Participant 1 contributes
    client.contribute(&trip_id, &participant1, &500_000);

    assert_eq!(client.get_balance(&trip_id, &participant1), 500_000);
    assert_eq!(client.get_state(&trip_id).total_collected, 500_000);
    assert_eq!(client.get_state(&trip_id).participant_count, 1);
    assert_eq!(client.get_state(&trip_id).status, Status::Funding);

    // Participant 2 contributes - should complete
    client.contribute(&trip_id, &participant2, &600_000);

    assert_eq!(client.get_balance(&trip_id, &participant2), 600_000);
    assert_eq!(client.get_state(&trip_id).total_collected, 1_100_000);
    assert_eq!(client.get_state(&trip_id).participant_count, 2);
    assert_eq!(client.get_state(&trip_id).status, Status::Completed);
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

    let trip_id = client.create_trip(
        &organizer,
        &token_address,
        &1_000_000,
        &2,
        &2000,
        &10,
    );

    let initial_balance = token_client.balance(&participant1);

    client.contribute(&trip_id, &participant1, &500_000);
    client.contribute(&trip_id, &participant2, &500_000);

    client.withdraw(&trip_id, &participant1);

    let final_balance = token_client.balance(&participant1);
    // 10% penalty: refund = 500_000 - 50_000 = 450_000
    assert_eq!(final_balance, initial_balance - 50_000);
    // Participant 2 gets the penalty
    assert_eq!(client.get_balance(&trip_id, &participant2), 550_000);
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

    let trip_id = client.create_trip(
        &organizer,
        &token_address,
        &1_000_000,
        &2,
        &2000,
        &10,
    );

    client.contribute(&trip_id, &participant1, &500_000);
    client.contribute(&trip_id, &participant2, &600_000);

    assert_eq!(client.get_state(&trip_id).status, Status::Completed);

    let organizer_balance_before = token_client.balance(&organizer);

    client.release(&trip_id);

    assert_eq!(client.get_state(&trip_id).status, Status::Released);
    assert_eq!(client.get_state(&trip_id).total_collected, 0);

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

    let trip_id = client.create_trip(
        &organizer,
        &token_address,
        &1_000_000,
        &2,
        &2000,
        &10,
    );

    let p1_initial = token_client.balance(&participant1);
    let p2_initial = token_client.balance(&participant2);

    client.contribute(&trip_id, &participant1, &300_000);
    client.contribute(&trip_id, &participant2, &200_000);

    client.cancel(&trip_id);

    assert_eq!(client.get_state(&trip_id).status, Status::Cancelled);
    // Full refund (no penalty on cancel)
    assert_eq!(token_client.balance(&participant1), p1_initial);
    assert_eq!(token_client.balance(&participant2), p2_initial);
}

#[test]
fn test_multiple_trips_isolation() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let organizer1 = Address::generate(&env);
    let organizer2 = Address::generate(&env);
    let participant = Address::generate(&env);

    let (_, token_admin) = create_token_contract(&env, &admin);
    let token_address = token_admin.address.clone();

    token_admin.mint(&participant, &100_000_000);

    let contract_id = env.register(CotravelEscrow, ());
    let client = CotravelEscrowClient::new(&env, &contract_id);

    env.ledger().set_timestamp(1000);

    // Create two trips with different organizers
    let trip1 = client.create_trip(
        &organizer1,
        &token_address,
        &1_000_000,
        &1,
        &2000,
        &10,
    );

    let trip2 = client.create_trip(
        &organizer2,
        &token_address,
        &2_000_000,
        &1,
        &3000,
        &20,
    );

    // Contribute to both trips
    client.contribute(&trip1, &participant, &1_000_000);
    client.contribute(&trip2, &participant, &500_000);

    // Verify isolation
    assert_eq!(client.get_balance(&trip1, &participant), 1_000_000);
    assert_eq!(client.get_balance(&trip2, &participant), 500_000);

    assert_eq!(client.get_state(&trip1).status, Status::Completed);
    assert_eq!(client.get_state(&trip2).status, Status::Funding);

    // Get trip info
    let info1 = client.get_trip(&trip1);
    assert_eq!(info1.organizer, organizer1);
    assert_eq!(info1.total_collected, 1_000_000);

    let info2 = client.get_trip(&trip2);
    assert_eq!(info2.organizer, organizer2);
    assert_eq!(info2.total_collected, 500_000);
}
