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

// ===== Legacy create_trip tests (backwards compatibility) =====

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
    assert_eq!(state.version, 0);

    // Recipients should be empty for legacy trips
    let recipients = client.get_recipients(&trip_id);
    assert_eq!(recipients.len(), 0);

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

    // Participant 2 contributes exactly enough - should complete
    client.contribute(&trip_id, &participant2, &500_000);

    assert_eq!(client.get_balance(&trip_id, &participant2), 500_000);
    assert_eq!(client.get_state(&trip_id).total_collected, 1_000_000);
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
    // Penalty stays in pool — participant2 balance unchanged
    assert_eq!(client.get_balance(&trip_id, &participant2), 500_000);
    // Penalty tracked in penalty pool
    assert_eq!(client.get_penalty(&trip_id, &participant1), 50_000);
    // total_collected = 1_000_000 - 450_000 (refund) = 550_000 (includes 50k penalty)
    assert_eq!(client.get_state(&trip_id).total_collected, 550_000);
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
    client.contribute(&trip_id, &participant2, &500_000);

    assert_eq!(client.get_state(&trip_id).status, Status::Completed);

    let organizer_balance_before = token_client.balance(&organizer);

    // Organizer triggers release (escape hatch)
    client.release(&trip_id);

    assert_eq!(client.get_state(&trip_id).status, Status::Released);
    assert_eq!(client.get_state(&trip_id).total_collected, 0);

    let organizer_balance_after = token_client.balance(&organizer);
    assert_eq!(organizer_balance_after - organizer_balance_before, 1_000_000);
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

// ===== New invoice / recipients tests =====

#[test]
fn test_create_invoice_with_recipients() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let organizer = Address::generate(&env);
    let vendor1 = Address::generate(&env);
    let vendor2 = Address::generate(&env);

    let (_, token_admin) = create_token_contract(&env, &admin);
    let token_address = token_admin.address.clone();

    let contract_id = env.register(CotravelEscrow, ());
    let client = CotravelEscrowClient::new(&env, &contract_id);

    env.ledger().set_timestamp(1000);

    // Create recipients
    let recipients = soroban_sdk::vec![
        &env,
        Recipient { address: vendor1.clone(), amount: 600_000 },
        Recipient { address: vendor2.clone(), amount: 400_000 }
    ];

    let trip_id = client.create_invoice(
        &organizer,
        &token_address,
        &1_000_000,
        &2,
        &2000,
        &10,
        &recipients,
        &false,
    );

    assert_eq!(trip_id, 0);

    // Verify recipients stored
    let stored_recipients = client.get_recipients(&trip_id);
    assert_eq!(stored_recipients.len(), 2);
    assert_eq!(stored_recipients.get(0).unwrap().address, vendor1);
    assert_eq!(stored_recipients.get(0).unwrap().amount, 600_000);
    assert_eq!(stored_recipients.get(1).unwrap().address, vendor2);
    assert_eq!(stored_recipients.get(1).unwrap().amount, 400_000);

    // State should have version 0
    assert_eq!(client.get_state(&trip_id).version, 0);
}

#[test]
fn test_release_multi_recipient() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let organizer = Address::generate(&env);
    let vendor1 = Address::generate(&env);
    let vendor2 = Address::generate(&env);
    let participant1 = Address::generate(&env);
    let participant2 = Address::generate(&env);

    let (token_client, token_admin) = create_token_contract(&env, &admin);
    let token_address = token_admin.address.clone();

    token_admin.mint(&participant1, &10_000_000);
    token_admin.mint(&participant2, &10_000_000);

    let contract_id = env.register(CotravelEscrow, ());
    let client = CotravelEscrowClient::new(&env, &contract_id);

    env.ledger().set_timestamp(1000);

    let recipients = soroban_sdk::vec![
        &env,
        Recipient { address: vendor1.clone(), amount: 600_000 },
        Recipient { address: vendor2.clone(), amount: 400_000 }
    ];

    let trip_id = client.create_invoice(
        &organizer,
        &token_address,
        &1_000_000,
        &2,
        &2000,
        &10,
        &recipients,
        &false,
    );

    // Two participants contribute exactly to target (no overfunding)
    client.contribute(&trip_id, &participant1, &500_000);
    client.contribute(&trip_id, &participant2, &500_000);

    assert_eq!(client.get_state(&trip_id).status, Status::Completed);

    let v1_before = token_client.balance(&vendor1);
    let v2_before = token_client.balance(&vendor2);
    let org_before = token_client.balance(&organizer);

    // Organizer triggers release
    client.release(&trip_id);

    assert_eq!(client.get_state(&trip_id).status, Status::Released);

    // Vendor1 gets 600k, vendor2 gets 400k (exact target distribution)
    assert_eq!(token_client.balance(&vendor1) - v1_before, 600_000);
    assert_eq!(token_client.balance(&vendor2) - v2_before, 400_000);
    // Organizer gets nothing (no overfunding)
    assert_eq!(token_client.balance(&organizer) - org_before, 0);
}

#[test]
fn test_release_fallback_organizer() {
    // When recipients is empty, all funds go to organizer (legacy behavior)
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

    // Create invoice with empty recipients
    let empty_recipients: Vec<Recipient> = Vec::new(&env);
    let trip_id = client.create_invoice(
        &organizer,
        &token_address,
        &1_000_000,
        &2,
        &2000,
        &10,
        &empty_recipients,
        &false,
    );

    client.contribute(&trip_id, &participant1, &500_000);
    client.contribute(&trip_id, &participant2, &500_000);

    let org_before = token_client.balance(&organizer);
    // Organizer triggers release
    client.release(&trip_id);

    // All 1_000_000 goes to organizer (no overfunding)
    assert_eq!(token_client.balance(&organizer) - org_before, 1_000_000);
}

#[test]
fn test_update_recipients() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let organizer = Address::generate(&env);
    let vendor1 = Address::generate(&env);
    let vendor2 = Address::generate(&env);
    let vendor3 = Address::generate(&env);

    let (_, token_admin) = create_token_contract(&env, &admin);
    let token_address = token_admin.address.clone();

    let contract_id = env.register(CotravelEscrow, ());
    let client = CotravelEscrowClient::new(&env, &contract_id);

    env.ledger().set_timestamp(1000);

    let recipients = soroban_sdk::vec![
        &env,
        Recipient { address: vendor1.clone(), amount: 600_000 },
        Recipient { address: vendor2.clone(), amount: 400_000 }
    ];

    let trip_id = client.create_invoice(
        &organizer,
        &token_address,
        &1_000_000,
        &2,
        &2000,
        &10,
        &recipients,
        &false,
    );

    assert_eq!(client.get_state(&trip_id).version, 0);

    // Update recipients
    let new_recipients = soroban_sdk::vec![
        &env,
        Recipient { address: vendor1.clone(), amount: 300_000 },
        Recipient { address: vendor3.clone(), amount: 700_000 }
    ];

    client.update_recipients(&trip_id, &new_recipients);

    // Version should be incremented
    assert_eq!(client.get_state(&trip_id).version, 1);

    // Verify new recipients
    let stored = client.get_recipients(&trip_id);
    assert_eq!(stored.len(), 2);
    assert_eq!(stored.get(0).unwrap().address, vendor1);
    assert_eq!(stored.get(0).unwrap().amount, 300_000);
    assert_eq!(stored.get(1).unwrap().address, vendor3);
    assert_eq!(stored.get(1).unwrap().amount, 700_000);
}

#[test]
#[should_panic(expected = "Sum of recipient amounts must equal target amount")]
fn test_update_recipients_invalid_total() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let organizer = Address::generate(&env);
    let vendor1 = Address::generate(&env);

    let (_, token_admin) = create_token_contract(&env, &admin);
    let token_address = token_admin.address.clone();

    let contract_id = env.register(CotravelEscrow, ());
    let client = CotravelEscrowClient::new(&env, &contract_id);

    env.ledger().set_timestamp(1000);

    let empty_recipients: Vec<Recipient> = Vec::new(&env);
    let trip_id = client.create_invoice(
        &organizer,
        &token_address,
        &1_000_000,
        &2,
        &2000,
        &10,
        &empty_recipients,
        &false,
    );

    // Try to set recipients that don't sum to target
    let bad_recipients = soroban_sdk::vec![
        &env,
        Recipient { address: vendor1.clone(), amount: 500_000 }
    ];

    client.update_recipients(&trip_id, &bad_recipients);
}

#[test]
fn test_withdraw_penalty_free_after_modification() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let organizer = Address::generate(&env);
    let vendor1 = Address::generate(&env);
    let vendor2 = Address::generate(&env);
    let participant1 = Address::generate(&env);
    let participant2 = Address::generate(&env);

    let (token_client, token_admin) = create_token_contract(&env, &admin);
    let token_address = token_admin.address.clone();

    token_admin.mint(&participant1, &10_000_000);
    token_admin.mint(&participant2, &10_000_000);

    let contract_id = env.register(CotravelEscrow, ());
    let client = CotravelEscrowClient::new(&env, &contract_id);

    env.ledger().set_timestamp(1000);

    let recipients = soroban_sdk::vec![
        &env,
        Recipient { address: vendor1.clone(), amount: 600_000 },
        Recipient { address: vendor2.clone(), amount: 400_000 }
    ];

    let trip_id = client.create_invoice(
        &organizer,
        &token_address,
        &1_000_000,
        &2,
        &2000,
        &10,
        &recipients,
        &false,
    );

    // Participants contribute at version 0
    client.contribute(&trip_id, &participant1, &500_000);
    client.contribute(&trip_id, &participant2, &500_000);

    let p1_initial = token_client.balance(&participant1);

    // Organizer modifies the invoice (version becomes 1)
    let new_recipients = soroban_sdk::vec![
        &env,
        Recipient { address: vendor1.clone(), amount: 400_000 },
        Recipient { address: vendor2.clone(), amount: 600_000 }
    ];
    client.update_recipients(&trip_id, &new_recipients);
    assert_eq!(client.get_state(&trip_id).version, 1);

    // Participant 1 withdraws AFTER modification → no penalty (opt-out)
    client.withdraw(&trip_id, &participant1);

    let p1_final = token_client.balance(&participant1);
    // Should get full refund (no penalty) because version > contributed_at_version
    assert_eq!(p1_final - p1_initial, 500_000);
    // Participant 2 should NOT get any penalty redistribution
    assert_eq!(client.get_balance(&trip_id, &participant2), 500_000);
}

#[test]
fn test_withdraw_with_penalty_before_modification() {
    // Participant contributes and withdraws BEFORE any modification → normal penalty applies
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let organizer = Address::generate(&env);
    let vendor1 = Address::generate(&env);
    let participant1 = Address::generate(&env);
    let participant2 = Address::generate(&env);

    let (token_client, token_admin) = create_token_contract(&env, &admin);
    let token_address = token_admin.address.clone();

    token_admin.mint(&participant1, &10_000_000);
    token_admin.mint(&participant2, &10_000_000);

    let contract_id = env.register(CotravelEscrow, ());
    let client = CotravelEscrowClient::new(&env, &contract_id);

    env.ledger().set_timestamp(1000);

    let recipients = soroban_sdk::vec![
        &env,
        Recipient { address: vendor1.clone(), amount: 1_000_000 }
    ];

    let trip_id = client.create_invoice(
        &organizer,
        &token_address,
        &1_000_000,
        &2,
        &2000,
        &10,
        &recipients,
        &false,
    );

    client.contribute(&trip_id, &participant1, &500_000);
    client.contribute(&trip_id, &participant2, &500_000);

    let p1_initial = token_client.balance(&participant1);

    // No modification happened, withdraw should have penalty
    client.withdraw(&trip_id, &participant1);

    let p1_final = token_client.balance(&participant1);
    // 10% penalty: refund = 500_000 - 50_000 = 450_000
    assert_eq!(p1_final - p1_initial, 450_000);
}

// ===== New behavior tests =====

#[test]
#[should_panic(expected = "Contribution would exceed target amount")]
fn test_overfunding_rejected() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let organizer = Address::generate(&env);
    let participant1 = Address::generate(&env);
    let participant2 = Address::generate(&env);

    let (_, token_admin) = create_token_contract(&env, &admin);
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
    // This should panic: 500_000 + 600_000 > 1_000_000
    client.contribute(&trip_id, &participant2, &600_000);
}

#[test]
fn test_auto_release() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let organizer = Address::generate(&env);
    let vendor1 = Address::generate(&env);
    let vendor2 = Address::generate(&env);
    let participant1 = Address::generate(&env);
    let participant2 = Address::generate(&env);

    let (token_client, token_admin) = create_token_contract(&env, &admin);
    let token_address = token_admin.address.clone();

    token_admin.mint(&participant1, &10_000_000);
    token_admin.mint(&participant2, &10_000_000);

    let contract_id = env.register(CotravelEscrow, ());
    let client = CotravelEscrowClient::new(&env, &contract_id);

    env.ledger().set_timestamp(1000);

    let recipients = soroban_sdk::vec![
        &env,
        Recipient { address: vendor1.clone(), amount: 600_000 },
        Recipient { address: vendor2.clone(), amount: 400_000 }
    ];

    // Create with auto_release = true
    let trip_id = client.create_invoice(
        &organizer,
        &token_address,
        &1_000_000,
        &2,
        &2000,
        &10,
        &recipients,
        &true,
    );

    let v1_before = token_client.balance(&vendor1);
    let v2_before = token_client.balance(&vendor2);

    // First contribution: not enough yet
    client.contribute(&trip_id, &participant1, &500_000);
    assert_eq!(client.get_state(&trip_id).status, Status::Funding);

    // Second contribution reaches target → auto-release fires
    client.contribute(&trip_id, &participant2, &500_000);

    // Should jump straight to Released (Completed was transient)
    assert_eq!(client.get_state(&trip_id).status, Status::Released);
    assert_eq!(client.get_state(&trip_id).total_collected, 0);

    // Recipients got paid automatically
    assert_eq!(token_client.balance(&vendor1) - v1_before, 600_000);
    assert_eq!(token_client.balance(&vendor2) - v2_before, 400_000);
}

#[test]
fn test_cancel_returns_penalties() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let organizer = Address::generate(&env);
    let participant1 = Address::generate(&env);
    let participant2 = Address::generate(&env);
    let participant3 = Address::generate(&env);

    let (token_client, token_admin) = create_token_contract(&env, &admin);
    let token_address = token_admin.address.clone();

    token_admin.mint(&participant1, &10_000_000);
    token_admin.mint(&participant2, &10_000_000);
    token_admin.mint(&participant3, &10_000_000);

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

    client.contribute(&trip_id, &participant1, &400_000);
    client.contribute(&trip_id, &participant2, &400_000);
    client.contribute(&trip_id, &participant3, &200_000);

    // P1 withdraws with 10% penalty (penalty = 40_000, refund = 360_000)
    client.withdraw(&trip_id, &participant1);
    assert_eq!(client.get_penalty(&trip_id, &participant1), 40_000);
    assert_eq!(token_client.balance(&participant1), p1_initial - 40_000);

    // Now cancel — everybody gets refunded, including P1's penalty
    client.cancel(&trip_id);

    assert_eq!(client.get_state(&trip_id).status, Status::Cancelled);
    // P1 gets penalty back → net zero loss
    assert_eq!(token_client.balance(&participant1), p1_initial);
    // P2 gets full refund
    assert_eq!(token_client.balance(&participant2), p2_initial);
    // Penalty pool is cleared
    assert_eq!(client.get_penalty(&trip_id, &participant1), 0);
}

#[test]
fn test_claim_deadline() {
    // After deadline, anyone can trigger refund — no auth needed
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
        &2000, // deadline = 2000
        &10,
    );

    let p1_initial = token_client.balance(&participant1);
    let p2_initial = token_client.balance(&participant2);

    client.contribute(&trip_id, &participant1, &300_000);
    client.contribute(&trip_id, &participant2, &200_000);

    // Pool is in Funding, not enough to complete
    assert_eq!(client.get_state(&trip_id).status, Status::Funding);

    // Advance time past deadline
    env.ledger().set_timestamp(2001);

    // Anyone can call claim_deadline — the system (coTravel backend) triggers it
    client.claim_deadline(&trip_id);

    assert_eq!(client.get_state(&trip_id).status, Status::Cancelled);
    // Full refund, no penalty
    assert_eq!(token_client.balance(&participant1), p1_initial);
    assert_eq!(token_client.balance(&participant2), p2_initial);
}

#[test]
fn test_claim_deadline_with_penalties() {
    // Someone withdrew with penalty before deadline, then deadline expires → penalty returned
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
        &10, // 10% penalty
    );

    let p1_initial = token_client.balance(&participant1);
    let p2_initial = token_client.balance(&participant2);

    client.contribute(&trip_id, &participant1, &400_000);
    client.contribute(&trip_id, &participant2, &300_000);

    // P1 withdraws before deadline with penalty
    client.withdraw(&trip_id, &participant1);
    assert_eq!(client.get_penalty(&trip_id, &participant1), 40_000);
    assert_eq!(token_client.balance(&participant1), p1_initial - 40_000);

    // Advance past deadline
    env.ledger().set_timestamp(2001);

    // claim_deadline refunds P2 + returns P1's penalty
    client.claim_deadline(&trip_id);

    assert_eq!(client.get_state(&trip_id).status, Status::Cancelled);
    assert_eq!(token_client.balance(&participant1), p1_initial); // penalty returned
    assert_eq!(token_client.balance(&participant2), p2_initial); // full refund
}

#[test]
#[should_panic(expected = "Deadline has not passed yet")]
fn test_claim_deadline_too_early() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let organizer = Address::generate(&env);
    let participant1 = Address::generate(&env);

    let (_, token_admin) = create_token_contract(&env, &admin);
    let token_address = token_admin.address.clone();

    token_admin.mint(&participant1, &10_000_000);

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

    client.contribute(&trip_id, &participant1, &300_000);

    // Try to claim before deadline — should panic
    client.claim_deadline(&trip_id);
}

// ===== Confirm release tests =====

#[test]
fn test_confirm_release() {
    // When auto_release=false, participants confirm and pool auto-pays when all confirm
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let organizer = Address::generate(&env);
    let vendor1 = Address::generate(&env);
    let vendor2 = Address::generate(&env);
    let participant1 = Address::generate(&env);
    let participant2 = Address::generate(&env);

    let (token_client, token_admin) = create_token_contract(&env, &admin);
    let token_address = token_admin.address.clone();

    token_admin.mint(&participant1, &10_000_000);
    token_admin.mint(&participant2, &10_000_000);

    let contract_id = env.register(CotravelEscrow, ());
    let client = CotravelEscrowClient::new(&env, &contract_id);

    env.ledger().set_timestamp(1000);

    let recipients = soroban_sdk::vec![
        &env,
        Recipient { address: vendor1.clone(), amount: 600_000 },
        Recipient { address: vendor2.clone(), amount: 400_000 }
    ];

    // auto_release = false → manual confirmation flow
    let trip_id = client.create_invoice(
        &organizer,
        &token_address,
        &1_000_000,
        &2,
        &2000,
        &10,
        &recipients,
        &false,
    );

    // Both contribute → Completed
    client.contribute(&trip_id, &participant1, &500_000);
    client.contribute(&trip_id, &participant2, &500_000);
    assert_eq!(client.get_state(&trip_id).status, Status::Completed);

    let v1_before = token_client.balance(&vendor1);
    let v2_before = token_client.balance(&vendor2);

    // Participant 1 confirms
    client.confirm_release(&trip_id, &participant1);
    assert!(client.get_confirmation(&trip_id, &participant1));
    assert!(!client.get_confirmation(&trip_id, &participant2));
    assert_eq!(client.get_state(&trip_id).status, Status::Completed); // Still waiting
    assert_eq!(client.get_state(&trip_id).confirmation_count, 1);

    // Participant 2 confirms → all confirmed → auto-release
    client.confirm_release(&trip_id, &participant2);
    assert_eq!(client.get_state(&trip_id).confirmation_count, 2);

    // Should be Released now
    assert_eq!(client.get_state(&trip_id).status, Status::Released);
    assert_eq!(token_client.balance(&vendor1) - v1_before, 600_000);
    assert_eq!(token_client.balance(&vendor2) - v2_before, 400_000);
}

#[test]
fn test_confirm_release_resets_on_withdraw() {
    // If a participant withdraws and pool goes Completed→Funding, all confirmations reset
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let organizer = Address::generate(&env);
    let vendor1 = Address::generate(&env);
    let participant1 = Address::generate(&env);
    let participant2 = Address::generate(&env);
    let participant3 = Address::generate(&env);

    let (_, token_admin) = create_token_contract(&env, &admin);
    let token_address = token_admin.address.clone();

    token_admin.mint(&participant1, &10_000_000);
    token_admin.mint(&participant2, &10_000_000);
    token_admin.mint(&participant3, &10_000_000);

    let contract_id = env.register(CotravelEscrow, ());
    let client = CotravelEscrowClient::new(&env, &contract_id);

    env.ledger().set_timestamp(1000);

    let recipients = soroban_sdk::vec![
        &env,
        Recipient { address: vendor1.clone(), amount: 1_000_000 }
    ];

    let trip_id = client.create_invoice(
        &organizer,
        &token_address,
        &1_000_000,
        &2,
        &2000,
        &0, // No penalty for simplicity
        &recipients,
        &false,
    );

    // 3 participants contribute, reach target
    client.contribute(&trip_id, &participant1, &400_000);
    client.contribute(&trip_id, &participant2, &400_000);
    client.contribute(&trip_id, &participant3, &200_000);
    assert_eq!(client.get_state(&trip_id).status, Status::Completed);

    // P1 confirms
    client.confirm_release(&trip_id, &participant1);
    assert_eq!(client.get_state(&trip_id).confirmation_count, 1);
    assert!(client.get_confirmation(&trip_id, &participant1));

    // P3 withdraws → total drops below target → Funding
    // Pool will revert since 800_000 < 1_000_000
    client.withdraw(&trip_id, &participant3);
    assert_eq!(client.get_state(&trip_id).status, Status::Funding);

    // All confirmations should be reset
    assert_eq!(client.get_state(&trip_id).confirmation_count, 0);
    assert!(!client.get_confirmation(&trip_id, &participant1));
}

#[test]
#[should_panic(expected = "Pool is not in Completed status")]
fn test_confirm_release_not_completed() {
    // confirm_release only works when pool is in Completed status
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let organizer = Address::generate(&env);
    let vendor1 = Address::generate(&env);
    let participant1 = Address::generate(&env);

    let (_, token_admin) = create_token_contract(&env, &admin);
    let token_address = token_admin.address.clone();

    token_admin.mint(&participant1, &10_000_000);

    let contract_id = env.register(CotravelEscrow, ());
    let client = CotravelEscrowClient::new(&env, &contract_id);

    env.ledger().set_timestamp(1000);

    let recipients = soroban_sdk::vec![
        &env,
        Recipient { address: vendor1.clone(), amount: 1_000_000 }
    ];

    let trip_id = client.create_invoice(
        &organizer,
        &token_address,
        &1_000_000,
        &2,
        &2000,
        &0,
        &recipients,
        &false,
    );

    // Only 1 participant, not enough → still Funding
    client.contribute(&trip_id, &participant1, &500_000);
    assert_eq!(client.get_state(&trip_id).status, Status::Funding);

    // Should panic: not Completed
    client.confirm_release(&trip_id, &participant1);
}

#[test]
#[should_panic(expected = "Participant already confirmed")]
fn test_confirm_release_double_confirm() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let organizer = Address::generate(&env);
    let vendor1 = Address::generate(&env);
    let participant1 = Address::generate(&env);
    let participant2 = Address::generate(&env);

    let (_, token_admin) = create_token_contract(&env, &admin);
    let token_address = token_admin.address.clone();

    token_admin.mint(&participant1, &10_000_000);
    token_admin.mint(&participant2, &10_000_000);

    let contract_id = env.register(CotravelEscrow, ());
    let client = CotravelEscrowClient::new(&env, &contract_id);

    env.ledger().set_timestamp(1000);

    let recipients = soroban_sdk::vec![
        &env,
        Recipient { address: vendor1.clone(), amount: 1_000_000 }
    ];

    let trip_id = client.create_invoice(
        &organizer,
        &token_address,
        &1_000_000,
        &2,
        &2000,
        &0,
        &recipients,
        &false,
    );

    client.contribute(&trip_id, &participant1, &500_000);
    client.contribute(&trip_id, &participant2, &500_000);

    client.confirm_release(&trip_id, &participant1);
    // Double confirm should panic
    client.confirm_release(&trip_id, &participant1);
}
