import {useCallback} from 'react';
import {isConnected, requestAccess, signMessage} from '@stellar/freighter-api';
import {useWalletStore} from '@/stores/walletStore';
import * as api from '@/services/api';

export function useAuth() {
    const {address, isConnected: isWalletConnected, token, user, provider, connect, authenticate, disconnect} =
        useWalletStore();

    const isAuthenticated = !!token && !!user;

    const connectWallet = useCallback(async () => {
        const connResult = await isConnected();
        if (connResult.error || !connResult.isConnected) {
            throw new Error('Freighter wallet not found. Please install the extension.');
        }

        const accessResult = await requestAccess();
        if (accessResult.error || !accessResult.address) {
            throw new Error(accessResult.error?.message || 'Failed to get wallet address');
        }
        const walletAddress = accessResult.address;
        connect(walletAddress);

        // Challenge-response auth (SEP-0053 signMessage)
        const {challenge} = await api.getChallenge(walletAddress);

        const signResult = await signMessage(challenge, {
            address: walletAddress,
            networkPassphrase: 'Test SDF Network ; September 2015',
        });
        if (signResult.error || !signResult.signedMessage) {
            throw new Error(signResult.error?.message || 'Failed to sign challenge');
        }

        // signedMessage is base64 when returned as string (SEP-0053)
        const signature = typeof signResult.signedMessage === 'string'
            ? signResult.signedMessage
            : btoa(String.fromCharCode(...new Uint8Array(signResult.signedMessage)));

        const {token: jwt, user: userData} = await api.login(walletAddress, signature);
        authenticate(jwt, userData, 'wallet');

        return userData;
    }, [connect, authenticate]);

    const connectWithAccesly = useCallback(async (wallet: { stellarAddress: string; email: string }) => {
        connect(wallet.stellarAddress);
        const {token: jwt, user: userData} = await api.loginWithAccesly(
            wallet.email,
            wallet.stellarAddress,
        );
        authenticate(jwt, userData, 'accesly');
        return userData;
    }, [connect, authenticate]);

    const disconnectWallet = useCallback(() => {
        disconnect();
    }, [disconnect]);

    return {
        address,
        isConnected: isWalletConnected,
        isAuthenticated,
        token,
        user,
        provider,
        connectWallet,
        connectWithAccesly,
        disconnectWallet,
    };
}
