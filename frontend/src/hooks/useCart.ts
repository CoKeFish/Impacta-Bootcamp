import {useMutation, useQuery, useQueryClient} from '@tanstack/react-query';
import {toast} from 'sonner';
import {useTranslation} from 'react-i18next';
import * as api from '@/services/api';
import {useAuth} from '@/hooks/useAuth';

export function useCart() {
    const {isAuthenticated} = useAuth();
    const queryClient = useQueryClient();
    const {t} = useTranslation('cart');

    const {data, isLoading} = useQuery({
        queryKey: ['cart'],
        queryFn: api.getCart,
        enabled: isAuthenticated,
    });

    const addItem = useMutation({
        mutationFn: ({serviceId, quantity}: { serviceId: number; quantity?: number }) =>
            api.addToCart(serviceId, quantity),
        onSuccess: () => {
            queryClient.invalidateQueries({queryKey: ['cart']});
            toast.success(t('addedToCart'));
        },
        onError: (err: Error) => {
            toast.error(err.message);
        },
    });

    const updateItem = useMutation({
        mutationFn: ({id, quantity}: { id: number; quantity: number }) =>
            api.updateCartItem(id, quantity),
        onSuccess: () => {
            queryClient.invalidateQueries({queryKey: ['cart']});
        },
        onError: (err: Error) => {
            toast.error(err.message);
        },
    });

    const removeItem = useMutation({
        mutationFn: (id: number) => api.removeCartItem(id),
        onSuccess: () => {
            queryClient.invalidateQueries({queryKey: ['cart']});
            toast.success(t('removedFromCart'));
        },
        onError: (err: Error) => {
            toast.error(err.message);
        },
    });

    const clear = useMutation({
        mutationFn: api.clearCart,
        onSuccess: () => {
            queryClient.invalidateQueries({queryKey: ['cart']});
        },
    });

    const checkout = useMutation({
        mutationFn: api.checkoutCart,
        onSuccess: () => {
            queryClient.invalidateQueries({queryKey: ['cart']});
            queryClient.invalidateQueries({queryKey: ['myInvoices']});
        },
        onError: (err: Error) => {
            toast.error(err.message);
        },
    });

    return {
        items: data?.items ?? [],
        count: data?.count ?? 0,
        isLoading,
        addItem,
        updateItem,
        removeItem,
        clear,
        checkout,
    };
}
