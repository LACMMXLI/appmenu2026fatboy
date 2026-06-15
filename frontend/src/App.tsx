import React, { useState, useEffect } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { AuthView } from './views/AuthView';
import { RegisterView } from './views/RegisterView';
import { HomeView } from './views/HomeView';
import { MenuView } from './views/MenuView';
import { PromosView } from './views/PromosView';
import { CartView } from './views/CartView';
import { ProfileView } from './views/ProfileView';
import { ProductDetailView } from './views/ProductDetailView';
import { OrderTrackingView } from './views/OrderTrackingView';
import { RewardsView } from './views/RewardsView';
import { ChangePasswordView } from './views/ChangePasswordView';
import { PaymentMethodsView } from './views/PaymentMethodsView';
import { BranchesView } from './views/BranchesView';
import { AdminCatalogView } from './views/AdminCatalogView';
import { BranchOrdersView } from './views/BranchOrdersView';
import { GoogleReviewView } from './views/GoogleReviewView';
import { TopBar, BottomNav } from './components/layout/Navigation';
import { GoogleReviewPrompt } from './components/layout/GoogleReviewPrompt';
import { AppSplash } from './components/layout/AppSplash';
import { useUser } from './context/UserContext';
import { getSystemSettings, trackMenuVisit, type Product } from './lib/api';
import { GOOGLE_REVIEW_ROUTE, getGoogleReviewCooldown, isGoogleReviewRoutePath } from './lib/googleReviews';

const variants = {
  initial: { opacity: 0, y: 15 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.3 } },
  exit: { opacity: 0, y: -15, transition: { duration: 0.2 } }
};

const fullScreenVariants = {
  initial: { opacity: 0, scale: 0.98 },
  animate: { opacity: 1, scale: 1, transition: { duration: 0.4, ease: [0.16, 1, 0.3, 1] } },
  exit: { opacity: 0, scale: 1.02, transition: { duration: 0.3, ease: 'easeInOut' } }
};

const VISIT_TRACKED_SESSION_KEY = 'fatboy-menu-visit-tracked';

export default function App() {
  const { isAuthenticated } = useUser();
  const isAdminCatalogPath = window.location.pathname === '/admin-catalog';
  const isBranchOrdersPath = window.location.pathname === '/branch-orders';
  const [currentView, setCurrentView] = useState(() =>
    isGoogleReviewRoutePath(window.location.pathname) ? 'google-review' : 'home'
  );
  const [pendingAuthView, setPendingAuthView] = useState<string | null>(null);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  const [showSplash, setShowSplash] = useState(() => !sessionStorage.getItem('fatboy-app-splash-shown'));

  // Google Review prompt state & config URL
  const [googleReviewsUrl, setGoogleReviewsUrl] = useState('');
  const [showReviewPrompt, setShowReviewPrompt] = useState(false);

  useEffect(() => {
    if (isAdminCatalogPath || isBranchOrdersPath || sessionStorage.getItem(VISIT_TRACKED_SESSION_KEY)) {
      return;
    }

    sessionStorage.setItem(VISIT_TRACKED_SESSION_KEY, 'true');
    trackMenuVisit().catch((err) => {
      sessionStorage.removeItem(VISIT_TRACKED_SESSION_KEY);
      console.error('Error tracking menu visit:', err);
    });
  }, [isAdminCatalogPath, isBranchOrdersPath]);

  useEffect(() => {
    if (!showSplash) return;

    const timer = window.setTimeout(() => {
      sessionStorage.setItem('fatboy-app-splash-shown', 'true');
      setShowSplash(false);
    }, 1200);

    return () => window.clearTimeout(timer);
  }, [showSplash]);

  useEffect(() => {
    getSystemSettings()
      .then((settings) => {
        if (settings.google_reviews_url) {
          setGoogleReviewsUrl(settings.google_reviews_url);
        }
      })
      .catch((err) => console.error('Error fetching settings for review prompt:', err));
  }, []);

  useEffect(() => {
    if (currentView === 'google-review' || getGoogleReviewCooldown().blocked) {
      setShowReviewPrompt(false);
      return;
    }

    const dismissed = localStorage.getItem('fatboy-google-review-dismissed');
    const lastPrompted = localStorage.getItem('fatboy-google-review-last-prompted');
    
    const now = Date.now();
    const cooldownPeriod = 24 * 60 * 60 * 1000; // 24 hours
    
    const shouldPrompt = !dismissed && (!lastPrompted || (now - parseInt(lastPrompted, 10) > cooldownPeriod));
    
    if (shouldPrompt) {
      const timer = setTimeout(() => {
        setShowReviewPrompt(true);
      }, 2500); // Show 2.5 seconds after mounting / log in
      return () => clearTimeout(timer);
    } else {
      setShowReviewPrompt(false);
    }
  }, [currentView]);

  const handleDismissPrompt = () => {
    localStorage.setItem('fatboy-google-review-last-prompted', Date.now().toString());
    setShowReviewPrompt(false);
  };

  const handleRedirectToGoogle = () => {
    navigate('google-review');
    localStorage.setItem('fatboy-google-review-dismissed', 'true');
    setShowReviewPrompt(false);
  };

  if (isAdminCatalogPath) {
    return <AdminCatalogView />;
  }

  if (isBranchOrdersPath) {
    return <BranchOrdersView />;
  }

  const isFullScreen = ['auth', 'register', 'product-detail', 'order-tracking', 'rewards', 'change-password', 'payment-methods', 'branches', 'google-review'].includes(currentView);
  const privateViews = ['cart', 'rewards', 'change-password', 'payment-methods'];

  const navigate = (view: string, extra?: any) => {
    if (view === 'google-review' && !isGoogleReviewRoutePath(window.location.pathname)) {
      window.history.pushState(null, '', GOOGLE_REVIEW_ROUTE);
    }

    if (view !== 'google-review' && isGoogleReviewRoutePath(window.location.pathname)) {
      window.history.replaceState(null, '', '/');
    }

    if (privateViews.includes(view) && !isAuthenticated) {
      setPendingAuthView(view);
      setCurrentView('auth');
      return;
    }

    if (view === 'product-detail') {
      setSelectedProduct(extra ?? null);
    }

    if (view === 'menu') {
      if (typeof extra === 'string') {
        setSelectedCategoryId(extra);
      } else {
        setSelectedCategoryId(null);
      }
    }

    if (view !== 'auth' && view !== 'register') {
      setPendingAuthView(null);
    }

    setCurrentView(view);
  };

  const handleLogin = () => {
    setCurrentView(pendingAuthView ?? 'home');
    setPendingAuthView(null);
  };

  const handleRegister = () => {
    setCurrentView(pendingAuthView ?? 'profile');
    setPendingAuthView(null);
  };

  const renderFullScreenView = () => {
    switch (currentView) {
      case 'auth': return <motion.div key="auth" variants={fullScreenVariants} initial="initial" animate="animate" exit="exit" className="absolute inset-0 z-50 bg-background"><AuthView onNavigate={navigate} onLogin={handleLogin} /></motion.div>;
      case 'register': return <motion.div key="register" variants={fullScreenVariants} initial="initial" animate="animate" exit="exit" className="absolute inset-0 z-50 bg-background"><RegisterView onNavigate={navigate} onRegister={handleRegister} /></motion.div>;
      case 'product-detail': return <motion.div key="product-detail" variants={fullScreenVariants} initial="initial" animate="animate" exit="exit" className="absolute inset-0 z-50 bg-background"><ProductDetailView onNavigate={navigate} product={selectedProduct} /></motion.div>;
      case 'order-tracking': return <motion.div key="order-tracking" variants={fullScreenVariants} initial="initial" animate="animate" exit="exit" className="absolute inset-0 z-50 bg-background"><OrderTrackingView onNavigate={navigate} /></motion.div>;
      case 'rewards': return <motion.div key="rewards" variants={fullScreenVariants} initial="initial" animate="animate" exit="exit" className="absolute inset-0 z-50 bg-background"><RewardsView onNavigate={navigate} /></motion.div>;
      case 'change-password': return <motion.div key="change-password" variants={fullScreenVariants} initial="initial" animate="animate" exit="exit" className="absolute inset-0 z-50 bg-background"><ChangePasswordView onNavigate={navigate} /></motion.div>;
      case 'payment-methods': return <motion.div key="payment-methods" variants={fullScreenVariants} initial="initial" animate="animate" exit="exit" className="absolute inset-0 z-50 bg-background"><PaymentMethodsView onNavigate={navigate} /></motion.div>;
      case 'branches': return <motion.div key="branches" variants={fullScreenVariants} initial="initial" animate="animate" exit="exit" className="absolute inset-0 z-50 bg-background"><BranchesView onNavigate={navigate} /></motion.div>;
      case 'google-review': return <motion.div key="google-review" variants={fullScreenVariants} initial="initial" animate="animate" exit="exit" className="absolute inset-0 z-50 bg-white text-black"><GoogleReviewView onNavigate={navigate} /></motion.div>;
      default: return null;
    }
  };

  return (
    <div className="min-h-[100dvh] bg-background text-white w-full max-w-md mx-auto relative overflow-hidden font-sans">
      {/* Global Google Review overlay banner */}
      <AnimatePresence>
        {showReviewPrompt && (
          <GoogleReviewPrompt
            onClose={handleDismissPrompt}
            onRedirect={handleRedirectToGoogle}
          />
        )}
      </AnimatePresence>

      <AnimatePresence mode="wait">
        {isFullScreen && renderFullScreenView()}
      </AnimatePresence>

      {!isFullScreen && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col h-[100dvh]">
          <TopBar onNavigate={navigate} />
          <div className="flex-1 relative overflow-hidden">
            <AnimatePresence mode="wait">
              {currentView === 'home' && (
                <motion.div key="home" variants={variants} initial="initial" animate="animate" exit="exit" className="absolute inset-0 flex flex-col">
                  <HomeView onNavigate={navigate} />
                </motion.div>
              )}
              {currentView === 'menu' && (
                <motion.div key="menu" variants={variants} initial="initial" animate="animate" exit="exit" className="absolute inset-0 flex flex-col">
                  <MenuView onNavigate={navigate} initialCategoryId={selectedCategoryId} />
                </motion.div>
              )}
              {currentView === 'promos' && (
                <motion.div key="promos" variants={variants} initial="initial" animate="animate" exit="exit" className="absolute inset-0 flex flex-col">
                  <PromosView onNavigate={navigate} />
                </motion.div>
              )}
              {currentView === 'cart' && (
                <motion.div key="cart" variants={variants} initial="initial" animate="animate" exit="exit" className="absolute inset-0 flex flex-col">
                  <CartView onNavigate={navigate} />
                </motion.div>
              )}
              {currentView === 'profile' && (
                <motion.div key="profile" variants={variants} initial="initial" animate="animate" exit="exit" className="absolute inset-0 flex flex-col">
                  <ProfileView onNavigate={navigate} />
                </motion.div>
              )}
            </AnimatePresence>
          </div>
          <BottomNav currentView={currentView} onNavigate={navigate} />
        </motion.div>
      )}

      <AnimatePresence>
        {showSplash && <AppSplash />}
      </AnimatePresence>
    </div>
  );

}
