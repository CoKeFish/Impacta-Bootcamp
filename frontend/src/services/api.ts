import type {
    AdminStats,
    AuthChallenge,
    AuthLogin,
    Business,
    HealthStatus,
    ImageInfo,
    ImageUploadResponse,
    Invoice,
    InvoiceItem,
    InvoiceParticipant,
    PaginatedResponse,
    Service,
    User,
} from '@/types';

const BASE_URL = '';

async function request<T>(
    path: string,
    options: RequestInit = {},
): Promise<T> {
    const token = localStorage.getItem('jwt');
    const headers: Record<string, string> = {
        ...((options.headers as Record<string, string>) ?? {}),
    };

    if (token) {
        headers['Authorization'] = `Bearer ${token}`;
    }

    if (!(options.body instanceof FormData)) {
        headers['Content-Type'] = 'application/json';
    }

    const res = await fetch(`${BASE_URL}${path}`, {
        ...options,
        headers,
    });

    if (!res.ok) {
        const body = await res.json().catch(() => ({error: res.statusText}));
        throw new Error(body.error || `HTTP ${res.status}`);
    }

    return res.json() as Promise<T>;
}

// ─── Health ─────────────────────────────────────────────────────────────────

export const getHealth = () => request<HealthStatus>('/health');

// ─── Auth ───────────────────────────────────────────────────────────────────

export const getChallenge = (wallet: string) =>
    request<AuthChallenge>(`/api/auth/challenge?wallet=${wallet}`);

export const login = (wallet: string, signature: string) =>
    request<AuthLogin>('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({wallet, signature}),
    });

export const devLogin = (wallet_address: string) =>
    request<AuthLogin>('/api/auth/dev-login', {
        method: 'POST',
        body: JSON.stringify({wallet_address}),
    });

export const getMe = () => request<User>('/api/auth/me');

// ─── Users ──────────────────────────────────────────────────────────────────

export const createUser = (wallet_address: string, username?: string) =>
    request<User>('/api/users', {
        method: 'POST',
        body: JSON.stringify({wallet_address, username}),
    });

export const getUserByWallet = (wallet: string) =>
    request<User>(`/api/users/${wallet}`);

// ─── Images ─────────────────────────────────────────────────────────────────

export const uploadImage = (file: File) => {
    const form = new FormData();
    form.append('image', file);
    return request<ImageUploadResponse>('/images/upload', {
        method: 'POST',
        body: form,
    });
};

export const getImages = () => request<ImageInfo[]>('/images');

// ─── Businesses ─────────────────────────────────────────────────────────────

export const getBusinesses = (page = 1, limit = 20) =>
    request<Business[]>(`/api/businesses?page=${page}&limit=${limit}`);

export const getBusiness = (id: number) =>
    request<Business>(`/api/businesses/${id}`);

export const getMyBusinesses = () =>
    request<Business[]>('/api/businesses/my/list');

export const createBusiness = (data: {
    name: string;
    category?: string;
    description?: string;
    logo_url?: string;
    wallet_address?: string;
    contact_email?: string;
}) =>
    request<Business>('/api/businesses', {
        method: 'POST',
        body: JSON.stringify(data),
    });

export const updateBusiness = (id: number, data: Partial<{
    name: string;
    category: string;
    description: string;
    logo_url: string;
    wallet_address: string;
    contact_email: string;
    active: boolean;
}>) =>
    request<Business>(`/api/businesses/${id}`, {
        method: 'PUT',
        body: JSON.stringify(data),
    });

export const getBusinessServices = (businessId: number) =>
    request<Service[]>(`/api/businesses/${businessId}/services`);

// ─── Services ───────────────────────────────────────────────────────────────

export const getServices = (query?: string) =>
    request<Service[]>(
        `/api/services${query ? `?q=${encodeURIComponent(query)}` : ''}`,
    );

export const getService = (id: number) =>
    request<Service>(`/api/services/${id}`);

export const createService = (data: {
    business_id: number;
    name: string;
    description?: string;
    price: number;
    image_url?: string;
}) =>
    request<Service>('/api/services', {
        method: 'POST',
        body: JSON.stringify(data),
    });

export const updateService = (id: number, data: Partial<{
    name: string;
    description: string;
    price: number;
    image_url: string;
    active: boolean;
}>) =>
    request<Service>(`/api/services/${id}`, {
        method: 'PUT',
        body: JSON.stringify(data),
    });

// ─── Invoices ───────────────────────────────────────────────────────────────

export const getMyInvoices = (page = 1, limit = 20) =>
    request<PaginatedResponse<Invoice>>(
        `/api/invoices/my?page=${page}&limit=${limit}`,
    );

export const getInvoiceByCode = (code: string) =>
    request<Invoice & {
        items: InvoiceItem[];
        participants: Array<{ wallet_address: string; username: string | null; status: string }>
    }>(
        `/api/invoices/join/${encodeURIComponent(code)}`,
    );

export const getInvoice = (id: number) =>
    request<Invoice & { items: InvoiceItem[] }>(`/api/invoices/${id}`);

export const createInvoice = (data: {
    name: string;
    description?: string;
    items: Array<{
        service_id?: number;
        description: string;
        amount: number;
        recipient_wallet?: string;
        sort_order?: number;
    }>;
    min_participants?: number;
    penalty_percent?: number;
    deadline: string;
    icon?: string;
    token_address?: string;
    auto_release?: boolean;
}) =>
    request<Invoice & { items: InvoiceItem[] }>('/api/invoices', {
        method: 'POST',
        body: JSON.stringify(data),
    });

export const linkInvoiceContract = (id: number, signed_xdr: string) =>
    request<Invoice & { tx_hash: string; contract_invoice_id: number }>(
        `/api/invoices/${id}/link-contract`,
        {
            method: 'POST',
            body: JSON.stringify({signed_xdr}),
        },
    );

export const updateInvoiceItems = (
    id: number,
    items: Array<{
        service_id?: number;
        description: string;
        amount: number;
        recipient_wallet?: string;
        sort_order?: number;
    }>,
    change_summary?: string,
    signed_xdr?: string,
) =>
    request<Invoice & { items: InvoiceItem[]; tx_hash?: string }>(
        `/api/invoices/${id}/items`,
        {
            method: 'PUT',
            body: JSON.stringify({items, change_summary, signed_xdr}),
        },
    );

export const releaseInvoice = (id: number, signed_xdr: string) =>
    request<Invoice & { tx_hash: string }>(`/api/invoices/${id}/release`, {
        method: 'POST',
        body: JSON.stringify({signed_xdr}),
    });

export const cancelInvoice = (id: number, signed_xdr?: string) =>
    request<Invoice & { tx_hash?: string }>(`/api/invoices/${id}/cancel`, {
        method: 'POST',
        body: JSON.stringify(signed_xdr ? {signed_xdr} : {}),
    });

export const claimDeadline = (id: number, signed_xdr: string) =>
    request<Invoice & { tx_hash: string }>(
        `/api/invoices/${id}/claim-deadline`,
        {
            method: 'POST',
            body: JSON.stringify({signed_xdr}),
        },
    );

// ─── Invoice Participants ───────────────────────────────────────────────────

export const getInvoiceParticipants = (invoiceId: number) =>
    request<InvoiceParticipant[]>(`/api/invoices/${invoiceId}/participants`);

export const joinInvoice = (invoiceId: number) =>
    request<InvoiceParticipant>(`/api/invoices/${invoiceId}/join`, {
        method: 'POST',
    });

export const contributeToInvoice = (
    invoiceId: number,
    signed_xdr: string,
    amount: number,
) =>
    request<{ tx_hash: string; contributed: number; invoice: Invoice }>(
        `/api/invoices/${invoiceId}/contribute`,
        {
            method: 'POST',
            body: JSON.stringify({signed_xdr, amount}),
        },
    );

export const withdrawFromInvoice = (invoiceId: number, signed_xdr: string) =>
    request<{ tx_hash: string; invoice: Invoice }>(
        `/api/invoices/${invoiceId}/withdraw`,
        {
            method: 'POST',
            body: JSON.stringify({signed_xdr}),
        },
    );

export const confirmRelease = (invoiceId: number, signed_xdr?: string) =>
    request<{ participant: InvoiceParticipant; confirmation_count: number }>(
        `/api/invoices/${invoiceId}/confirm`,
        {
            method: 'POST',
            body: JSON.stringify({signed_xdr}),
        },
    );

// ─── Admin ──────────────────────────────────────────────────────────────────

export const getAdminStats = () =>
    request<AdminStats>('/api/admin/stats');

export const getAdminUsers = (page = 1, limit = 50) =>
    request<PaginatedResponse<User>>(`/api/admin/users?page=${page}&limit=${limit}`);

export const updateUserRole = (userId: number, role: 'user' | 'admin') =>
    request<User>(`/api/admin/users/${userId}/role`, {
        method: 'PUT',
        body: JSON.stringify({role}),
    });

export const getAdminBusinesses = (page = 1, limit = 20) =>
    request<PaginatedResponse<Business>>(
        `/api/admin/businesses?page=${page}&limit=${limit}`,
    );

export const getAdminInvoices = (page = 1, limit = 20) =>
    request<PaginatedResponse<Invoice>>(
        `/api/admin/invoices?page=${page}&limit=${limit}`,
    );
