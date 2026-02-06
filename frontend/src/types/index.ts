export interface User {
    id: number;
    wallet_address: string;
    username: string | null;
    avatar_url: string | null;
    created_at: string;
}

export interface Trip {
    id: number;
    organizer_id: number;
    organizer_wallet: string;
    organizer_name: string | null;
    contract_trip_id: number | null;
    name: string;
    description: string | null;
    cover_image_url: string | null;
    target_amount: string;
    min_participants: number;
    penalty_percent: number;
    deadline: string;
    status: 'draft' | 'funding' | 'completed' | 'cancelled' | 'released';
    total_collected: string;
    participant_count: number;
    created_at: string;
    updated_at: string;
    onchain?: OnchainState;
    onchain_error?: string;
}

export interface OnchainState {
    status: string;
    total_collected: string;
    participant_count: number;
}

export interface Participant {
    id: number;
    trip_id: number;
    user_id: number;
    wallet_address: string;
    username: string | null;
    contributed_amount: string;
    joined_at: string;
    status: 'active' | 'withdrawn';
    invitation_code: string | null;
}

export interface Transaction {
    id: number;
    trip_id: number;
    user_id: number;
    wallet_address: string;
    username: string | null;
    tx_hash: string;
    type: 'create_trip' | 'contribution' | 'withdrawal' | 'release' | 'cancel';
    amount: string;
    ledger_sequence: number;
    event_data: Record<string, unknown> | null;
    created_at: string;
}

export interface Image {
    id: number;
    filename: string;
    mimetype: string;
    size: number;
    trip_id: number | null;
    uploaded_by: number | null;
    created_at: string;
}

export interface AuthChallenge {
    challenge: string;
}

export interface AuthLogin {
    token: string;
    user: User;
}

export interface HealthStatus {
    status: 'ok' | 'error';
    database: string;
    storage: string;
}
