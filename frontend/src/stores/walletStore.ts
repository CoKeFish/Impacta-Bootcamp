import {create} from 'zustand';
import {persist} from 'zustand/middleware';
import type {User} from '@/types';

interface WalletState {
    address: string | null;
    isConnected: boolean;
    token: string | null;
    user: User | null;

    connect: (address: string) => void;
    authenticate: (token: string, user: User) => void;
    disconnect: () => void;
}

export const useWalletStore = create<WalletState>()(
    persist(
        (set) => ({
            address: null,
            isConnected: false,
            token: null,
            user: null,

            connect: (address) => set({address, isConnected: true}),

            authenticate: (token, user) => {
                localStorage.setItem('jwt', token);
                set({token, user});
            },

            disconnect: () => {
                localStorage.removeItem('jwt');
                set({address: null, isConnected: false, token: null, user: null});
            },
        }),
        {
            name: 'cotravel-wallet',
            partialize: (state) => ({
                address: state.address,
                isConnected: state.isConnected,
                token: state.token,
                user: state.user,
            }),
        },
    ),
);
