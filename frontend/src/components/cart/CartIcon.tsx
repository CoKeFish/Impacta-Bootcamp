import {Link} from 'react-router-dom';
import {ShoppingCart} from 'lucide-react';
import {useCart} from '@/hooks/useCart';
import {useAuth} from '@/hooks/useAuth';

export function CartIcon() {
    const {isAuthenticated} = useAuth();
    const {count} = useCart();

    if (!isAuthenticated) return null;

    return (
        <Link
            to="/checkout"
            className="relative flex items-center justify-center h-9 w-9 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            title="Cart"
        >
            <ShoppingCart className="h-5 w-5"/>
            {count > 0 && (
                <span
                    className="absolute -top-1 -right-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1 text-[11px] font-semibold text-primary-foreground">
                    {count > 99 ? '99+' : count}
                </span>
            )}
        </Link>
    );
}
