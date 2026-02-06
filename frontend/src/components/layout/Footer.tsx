export function Footer() {
    return (
        <footer className="border-t py-6 md:py-0">
            <div className="container flex flex-col items-center justify-between gap-4 md:h-16 md:flex-row">
                <p className="text-sm text-muted-foreground">
                    CoTravel &mdash; Group travel powered by Stellar
                </p>
                <p className="text-xs text-muted-foreground">
                    Testnet &middot; Impacta Bootcamp 2026
                </p>
            </div>
        </footer>
    );
}
