import React, { useEffect, useState } from 'react';
import Navbar from './components/Navbar';
import BrandLogo from './components/BrandLogo';
import Sidebar from './components/Sidebar';
import TopBar from './components/TopBar';
import LoginPage from './pages/LoginPage';
import HomePage from './pages/HomePage';
import PgPaymentPage from './pages/PgPaymentPage';
import AdminPage from './pages/AdminPage';
import PgSettingsPage from './pages/PgSettingsPage';
import CustomersPage from './pages/CustomersPage';
import CustomerDetailPage from './pages/CustomerDetailPage';
import ImpsPage from './pages/ImpsPage';
import ReportsPage from './pages/ReportsPage';
import TransactionsPage from './pages/TransactionsPage';
import WalletSettlementPage from './pages/WalletSettlementPage';
import QrCodesPage from './pages/QrCodesPage';
import QrRequestsPage from './pages/QrRequestsPage';
import CardPaymentsPage from './pages/CardPaymentsPage';
import PgStatusPage from './pages/PgStatusPage';
import { fromPath, toPath } from './utils/router';
import { apiUrl } from './utils/api';
import { takePaymentReturnSession } from './utils/pgStatus';

const PAGES = {
  login: LoginPage,
  home: HomePage,
  pg: PgPaymentPage,
  admin: AdminPage,
  pgsettings: PgSettingsPage,
  customers: CustomersPage,
  customerDetail: CustomerDetailPage,
  imps: ImpsPage,
  reports: ReportsPage,
  transactions: TransactionsPage,
  walletSettlement: WalletSettlementPage,
  qrCodes: QrCodesPage,
  qrRequests: QrRequestsPage,
  cardPayments: CardPaymentsPage,
};

const SESSION_KEY = 'tamilpay_user';

// "Keep me signed in" picks localStorage (survives closing the browser) vs
// sessionStorage (cleared when the tab closes); either way a refresh restores it.
function loadStoredUser() {
  try {
    const raw = localStorage.getItem(SESSION_KEY) || sessionStorage.getItem(SESSION_KEY);
    if (raw) return JSON.parse(raw);

    // Returning from the payment gateway in a fresh tab: take back the session stashed
    // when the link was created, so the payer lands on the ledger rather than a login.
    // Only a load carrying the payment token may do this, and it works once.
    if (new URLSearchParams(window.location.search).get('t')) {
      const returning = takePaymentReturnSession();
      if (returning) {
        sessionStorage.setItem(SESSION_KEY, JSON.stringify(returning));
        return returning;
      }
    }
    return null;
  } catch {
    return null;
  }
}

function App() {
  // The logged-in user, as returned by POST /api/auth/login (null until signed in).
  const [user, setUser] = useState(loadStoredUser);
  // State to track current page: 'login' | 'home' | 'customers' | 'customerDetail' — seeded
  // from the URL on first load (so a refresh or a shared link lands back on the same page,
  // not always Home), falling back to Home for anything the URL doesn't recognize.
  const [currentPage, setCurrentPage] = useState(() => {
    // The payment status page is where a payer lands after the gateway — they are not
    // signed in, so it is reachable without a session.
    const landed = fromPath(window.location.pathname).page;
    if (landed === 'pgStatus') return 'pgStatus';
    if (!loadStoredUser()) {
      // The gateway sends the payer to the wallet ledger. On a device where nobody is
      // signed in (the link was opened in a new tab or on the payer's own phone) the
      // ledger is not theirs to see, but their payment result is — so show that
      // instead of a bare login form.
      const paymentToken = new URLSearchParams(window.location.search).get('t');
      return landed === 'walletSettlement' && paymentToken ? 'pgStatus' : 'login';
    }
    return fromPath(window.location.pathname).page ?? 'home';
  });
  const [navParams, setNavParams] = useState(() => (
    loadStoredUser() ? fromPath(window.location.pathname).params : null
  ));
  // Bumped whenever the wallet balance changes anywhere (e.g. Navbar's Add Credit) so
  // pages showing wallet-derived figures (like the home dashboard) know to refetch.
  const [walletVersion, setWalletVersion] = useState(0);
  const bumpWalletVersion = () => setWalletVersion((v) => v + 1);

  const navigate = (page, params = null) => {
    setCurrentPage(page);
    setNavParams(params);
    const path = toPath(page, params);
    if (window.location.pathname !== path) {
      window.history.pushState(null, '', path);
    }
  };

  // Keeps the address bar in sync with browser Back/Forward, and normalizes it once on
  // load if it didn't match a real page (e.g. a stale/unrecognized path, or a protected
  // path visited while signed out) — without adding an extra history entry for that.
  useEffect(() => {
    const expected = toPath(currentPage, navParams);
    if (window.location.pathname !== expected) {
      // Keep the query string: tidying /pg-status/ to /pg-status must not throw away the
      // token the gateway sent the payer back with.
      window.history.replaceState(null, '', expected + window.location.search);
    }

    const onPopState = () => {
      const { page, params } = fromPath(window.location.pathname);
      setCurrentPage(page ?? 'home');
      setNavParams(params);
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
    // Only ever runs once — navigate() and onPopState are the only things that should
    // change currentPage/navParams after this.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // The login response carries walletId 0 for most accounts — the customer record has no
  // wallet on it — and every page that filters by wallet (Ledger, Transactions, Reports,
  // IMPS) quietly skips loading when it is 0. The real id only comes from the wallet
  // lookup, so it is resolved once here and written into the session for all of them.
  useEffect(() => {
    if (!user?.id || user.walletId) return undefined;
    let cancelled = false;
    fetch(apiUrl(`/api/customers/${user.id}/wallet`))
      .then((res) => (res.ok ? res.json() : null))
      .then((wallet) => {
        if (cancelled || !wallet?.Id) return;
        const withWallet = { ...user, walletId: wallet.Id };
        setUser(withWallet);
        try {
          [localStorage, sessionStorage].forEach((store) => {
            if (store.getItem(SESSION_KEY)) store.setItem(SESSION_KEY, JSON.stringify(withWallet));
          });
        } catch {
          // Storage unavailable — the id is still in memory for this visit.
        }
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [user]);

  const handleLogin = (loggedInUser, keepSignedIn) => {
    setUser(loggedInUser);
    try {
      (keepSignedIn ? localStorage : sessionStorage).setItem(SESSION_KEY, JSON.stringify(loggedInUser));
    } catch {
      // Storage unavailable (e.g. private browsing) — session just won't survive a refresh.
    }
    navigate('home');
  };

  const handleLogout = () => {
    setUser(null);
    try {
      localStorage.removeItem(SESSION_KEY);
      sessionStorage.removeItem(SESSION_KEY);
    } catch {
      // Storage unavailable — nothing to clean up.
    }
    navigate('login');
  };

  const CurrentPage = PAGES[currentPage] ?? HomePage;
  // Keying on the target customer/report (or lack of one) forces a clean remount
  // whenever navParams changes what a page should show on open — e.g. a different
  // customer's detail page, or Admin's "IMPS Report" tile deep-linking into Reports —
  // instead of reusing whatever that page component was already showing.
  const pageKey = `${currentPage}-${navParams?.customerId ?? navParams?.mode ?? navParams?.report ?? ''}`;

  if (currentPage === 'pgStatus') return <PgStatusPage />;

  // Signed-out: the login screen keeps its own full-page look under a plain logo bar —
  // no sidebar/topbar shell until someone's actually signed in.
  if (currentPage === 'login' || !user) {
    // app-bg is the same canvas and logo watermark the signed-in shell uses, so
    // the mark is on every page including this one.
    return (
      <div className="app-bg" style={{ fontFamily: 'Inter, Manrope, sans-serif' }}>
        <Navbar onNavigate={navigate} user={null} currentPage={currentPage} />
        <LoginPage onLogin={handleLogin} />
      </div>
    );
  }

  return (
    // app-bg carries the logo watermark behind every page; the brand bar sits
    // above both the rail and the content so the mark spans the full width.
    <div className="app-bg" style={{ fontFamily: 'Inter, Manrope, sans-serif' }}>
      {/* Logo, wallet and profile share one row — the brand and the account
          controls belong on the same line, not stacked in two bars. */}
      <header className="app-brandbar">
        <button type="button" className="app-brandbar-logo" onClick={() => navigate('home')} aria-label="TamilPay home">
          <BrandLogo height="clamp(44px, 6vw, 70px)" />
        </button>

        <TopBar
          user={user}
          onLogout={handleLogout}
          currentPage={currentPage}
          onWalletChanged={bumpWalletVersion}
          walletVersion={walletVersion}
        />
      </header>

      <div className="app-shell">
        <Sidebar user={user} currentPage={currentPage} onNavigate={navigate} />
        <div className="app-shell-main">
          <div className="app-shell-content">
            <CurrentPage
              key={pageKey}
              onNavigate={navigate}
              navParams={navParams}
              user={user}
              walletVersion={walletVersion}
              onWalletChanged={bumpWalletVersion}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;
