import type {AuthChallenge, AuthLogin, HealthStatus, Image, Participant, Trip, User,} from '@/types';

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

// Health
export const getHealth = () => request<HealthStatus>('/health');

// Auth
export const getChallenge = (wallet: string) =>
    request<AuthChallenge>(`/api/auth/challenge?wallet=${wallet}`);

export const login = (wallet: string, signature: string) =>
    request<AuthLogin>('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({wallet, signature}),
    });

export const getMe = () => request<User>('/api/auth/me');

// Users
export const createUser = (wallet_address: string, username?: string) =>
    request<User>('/api/users', {
        method: 'POST',
        body: JSON.stringify({wallet_address, username}),
    });

export const getUserByWallet = (wallet: string) =>
    request<User>(`/api/users/${wallet}`);

// Trips
export const getTrips = () => request<Trip[]>('/api/trips');

export const getTrip = (id: number) => request<Trip>(`/api/trips/${id}`);

export const createTrip = (data: {
    name: string;
    description?: string;
    target_amount: number;
    min_participants: number;
    penalty_percent?: number;
    deadline: string;
}) =>
    request<Trip>('/api/trips', {
        method: 'POST',
        body: JSON.stringify(data),
    });

export const linkContract = (id: number, signed_xdr: string) =>
    request<Trip & { tx_hash: string }>(`/api/trips/${id}/link-contract`, {
        method: 'POST',
        body: JSON.stringify({signed_xdr}),
    });

export const releaseTrip = (id: number, signed_xdr: string) =>
    request<Trip & { tx_hash: string }>(`/api/trips/${id}/release`, {
        method: 'POST',
        body: JSON.stringify({signed_xdr}),
    });

export const cancelTrip = (id: number, signed_xdr: string) =>
    request<Trip & { tx_hash: string }>(`/api/trips/${id}/cancel`, {
        method: 'POST',
        body: JSON.stringify({signed_xdr}),
    });

// Participants
export const getParticipants = (tripId: number) =>
    request<Participant[]>(`/api/trips/${tripId}/participants`);

export const joinTrip = (tripId: number) =>
    request<Participant>(`/api/trips/${tripId}/join`, {method: 'POST'});

export const contribute = (
    tripId: number,
    signed_xdr: string,
    amount: number,
) =>
    request<{ tx_hash: string; contributed: number; trip: Trip }>(
        `/api/trips/${tripId}/contribute`,
        {
            method: 'POST',
            body: JSON.stringify({signed_xdr, amount}),
        },
    );

export const withdraw = (tripId: number, signed_xdr: string) =>
    request<{ tx_hash: string; trip: Trip }>(`/api/trips/${tripId}/withdraw`, {
        method: 'POST',
        body: JSON.stringify({signed_xdr}),
    });

// Images
export const uploadImage = (file: File, tripId?: number) => {
    const form = new FormData();
    form.append('image', file);
    if (tripId) form.append('trip_id', String(tripId));
    return request<{ message: string; image: Image; url: string }>(
        '/images/upload',
        {method: 'POST', body: form},
    );
};

export const getImages = () => request<Image[]>('/images');
