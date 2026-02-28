import {create} from 'zustand';
import {persist} from 'zustand/middleware';
import type {User} from '@/types';

interface WalletState {
    address: string | null;
    isConnected: boolean;
    token: string | null;
    user: User | null;
    provider: 'wallet' | 'accesly' | null;

    connect: (address: string) => void;
    authenticate: (token: string, user: User, provider?: 'wallet' | 'accesly') => void;
    disconnect: () => void;
}

export const useWalletStore = create<WalletState>()(
    persist(
        (set) => ({
            address: null,
            isConnected: false,
            token: null,
            user: null,
            provider: null,

            connect: (address) => set({address, isConnected: true}),

            authenticate: (token, user, provider = 'wallet') => {
                localStorage.setItem('jwt', token);
                set({token, user, provider});
            },

            disconnect: () => {
                localStorage.removeItem('jwt');
                set({address: null, isConnected: false, token: null, user: null, provider: null});
            },
        }),
        {
            name: 'cotravel-wallet',
            partialize: (state) => ({
                address: state.address,
                isConnected: state.isConnected,
                token: state.token,
                user: state.user,
                provider: state.provider,
            }),
        },
    ),
);
