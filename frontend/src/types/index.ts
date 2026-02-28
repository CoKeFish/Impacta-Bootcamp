// ─── Core ────────────────────────────────────────────────────────────────────

export interface User {
    id: number;
    wallet_address: string | null;
    email: string | null;
    auth_provider: 'wallet' | 'accesly';
    username: string | null;
    avatar_url: string | null;
    role: 'user' | 'admin';
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

export interface PaginatedResponse<T> {
    data: T[];
    total: number;
    page: number;
    limit: number;
}

// ─── Schedule & Contact ─────────────────────────────────────────────────────

export interface TimeSlot {
    from: string;
    to: string;
}

export type DayOfWeek = 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday' | 'sunday';

export interface Schedule {
    not_applicable: boolean;
    timezone: string;
    slots: Record<DayOfWeek, TimeSlot[]>;
}

export interface ContactInfo {
    not_applicable: boolean;
    email: string;
    phone: string;
    whatsapp: string;
    website: string;
}

export interface LocationData {
    country: string;
    country_code: string;
    city: string;
    address: string;
    lat: number | null;
    lng: number | null;
}

// ─── Businesses & Services ──────────────────────────────────────────────────

export interface Business {
    id: number;
    owner_id: number;
    owner_wallet: string;
    owner_name: string | null;
    name: string;
    category: string | null;
    description: string | null;
    logo_url: string | null;
    wallet_address: string | null;
    contact_email: string | null;
    location: string | null;
    location_data: LocationData | null;
    schedule: Schedule | null;
    contact_info: ContactInfo | null;
    active: boolean;
    created_at: string;
    updated_at: string;
}

export interface Service {
    id: number;
    business_id: number;
    business_name: string;
    business_wallet: string | null;
    name: string;
    description: string | null;
    price: string;
    image_url: string | null;
    location: string | null;
    location_data: LocationData | null;
    effective_location: string | null;
    effective_location_data: LocationData | null;
    schedule: Schedule | null;
    contact_info: ContactInfo | null;
    effective_schedule: Schedule | null;
    effective_contact_info: ContactInfo | null;
    business_schedule?: Schedule | null;
    business_contact_info?: ContactInfo | null;
    business_location_data?: LocationData | null;
    active: boolean;
    created_at: string;
    updated_at: string;
}

// ─── Invoices ───────────────────────────────────────────────────────────────

export interface Invoice {
    id: number;
    organizer_id: number;
    organizer_wallet: string;
    organizer_name: string | null;
    contract_invoice_id: number | null;
    name: string;
    description: string | null;
    icon: string | null;
    token_address: string | null;
    auto_release: boolean;
    total_amount: string;
    total_collected: string;
    min_participants: number;
    penalty_percent: number;
    deadline: string;
    status: 'draft' | 'funding' | 'completed' | 'cancelled' | 'released';
    participant_count: number;
    version: number;
    confirmation_count: number;
    invite_code: string | null;
    created_at: string;
    updated_at: string;
    items?: InvoiceItem[];
    onchain?: OnchainState;
    onchain_error?: string;
}

export interface InvoiceItem {
    id: number;
    invoice_id: number;
    service_id: number | null;
    service_name: string | null;
    business_name: string | null;
    description: string;
    amount: string;
    recipient_wallet: string | null;
    sort_order: number;
    created_at: string;
}

export interface InvoiceParticipant {
    id: number;
    invoice_id: number;
    user_id: number;
    wallet_address: string;
    username: string | null;
    contributed_amount: string;
    contributed_at_version: number;
    penalty_amount: string | null;
    confirmed_release: boolean;
    status: 'active' | 'withdrawn';
    joined_at: string;
}

export interface InvoiceModification {
    id: number;
    invoice_id: number;
    version: number;
    change_summary: string | null;
    items_snapshot: InvoiceItem[] | null;
    created_at: string;
}

export interface OnchainState {
    status: string;
    total_collected: string;
    participant_count: number;
}

// ─── Cart ───────────────────────────────────────────────────────────────────

export interface CartItem {
    id: number;
    user_id: number;
    service_id: number;
    quantity: number;
    added_at: string;
    service_name: string;
    service_description: string | null;
    price: string;
    image_url: string | null;
    service_active: boolean;
    business_id: number;
    business_name: string;
    business_wallet: string | null;
}

export interface Cart {
    items: CartItem[];
    count: number;
}

// ─── Images ─────────────────────────────────────────────────────────────────

export interface ImageUploadResponse {
    message: string;
    filename: string;
    mimetype: string;
    size: number;
    url: string;
}

export interface ImageInfo {
    filename: string;
    size: number;
    lastModified: string;
    url: string;
}

// ─── Admin ──────────────────────────────────────────────────────────────────

export interface AdminStats {
    users: number;
    businesses: number;
    invoices: number;
}
