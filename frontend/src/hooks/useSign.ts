import {useCallback} from 'react';
import {useWalletStore} from '@/stores/walletStore';
import {signWithFreighter} from '@/lib/soroban';
import {useAccesly} from 'accesly';

export function useSign() {
    const {provider, address} = useWalletStore();
    const accesly = useAccesly();

    const signTransaction = useCallback(async (unsignedXdr: string): Promise<string> => {
        if (provider === 'accesly') {
            const result = await accesly.signTransaction(unsignedXdr);
            return result.signedXdr;
        }
        return signWithFreighter(unsignedXdr, address!);
    }, [provider, address, accesly]);

    return {signTransaction};
}
