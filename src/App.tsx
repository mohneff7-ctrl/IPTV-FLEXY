import { lazy, Suspense, useEffect, useState } from 'react';
import { HashRouter, Route, Routes, useLocation } from 'react-router-dom';
import { useSettings } from './store/settings';
import { useAddons } from './store/addons';
import { BottomNav, Drawer, TopBar } from './components/Shell';
import { Empty, Spinner, Toaster } from './components/ui';
import { ErrorBoundary } from './components/ErrorBoundary';
import { setupAddonLinks, setupBackButton, setupStatusBar } from './lib/native';
import Home from './pages/Home';
import Browse from './pages/Browse';
import Detail from './pages/Detail';

// Heavier / less frequent screens are split into their own chunks.
const Catalog = lazy(() => import('./pages/Catalog'));
const Search = lazy(() => import('./pages/Search'));
const Favorites = lazy(() => import('./pages/Favorites'));
const Addons = lazy(() => import('./pages/Addons'));
const Channels = lazy(() => import('./pages/Channels'));
const Settings = lazy(() => import('./pages/Settings'));
const Matches = lazy(() => import('./pages/Matches'));
const Player = lazy(() => import('./player/Player'));

function Layout() {
  const loc = useLocation();
  const [drawer, setDrawer] = useState(false);
  const path = loc.pathname;
  const immersive = path.startsWith('/play');
  const floatingHeader = path === '/' || path.startsWith('/browse');
  const showNav = !immersive && !path.startsWith('/detail');

  useEffect(() => {
    if (!path.startsWith('/detail')) window.scrollTo(0, 0);
  }, [path]);

  return (
    <div className={immersive ? 'app immersive' : 'app'}>
      {floatingHeader && <TopBar onMenu={() => setDrawer(true)} />}
      <Drawer open={drawer} onClose={() => setDrawer(false)} />
      <main className={showNav ? 'main with-nav' : 'main'}>
        <ErrorBoundary
          key={path}
          fallback={
            <div className="page page-pad">
              <Empty
                title="حدث خطأ في هذه الصفحة"
                text="Something went wrong on this screen."
                action={
                  <button className="btn btn-primary" onClick={() => (location.hash = '#/')}>
                    الرئيسية
                  </button>
                }
              />
            </div>
          }
        >
        <Suspense
          fallback={
            <div className="page center-fill">
              <Spinner />
            </div>
          }
        >
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/browse/:type" element={<Browse />} />
            <Route path="/catalog/:addonId/:type/:id" element={<Catalog />} />
            <Route path="/detail/:type/:id" element={<Detail />} />
            <Route path="/search" element={<Search />} />
            <Route path="/favorites" element={<Favorites />} />
            <Route path="/addons" element={<Addons />} />
            <Route path="/channels" element={<Channels />} />
            <Route path="/matches" element={<Matches />} />
            <Route path="/settings" element={<Settings />} />
            <Route path="/play" element={<Player />} />
            <Route path="*" element={<Home />} />
          </Routes>
        </Suspense>
        </ErrorBoundary>
      </main>
      {showNav && <BottomNav />}
      <Toaster />
    </div>
  );
}

export default function App() {
  const lang = useSettings((s) => s.lang);
  const bootstrap = useAddons((s) => s.bootstrap);

  useEffect(() => {
    bootstrap();
    setupStatusBar();
    setupAddonLinks((url) => {
      location.hash = `#/addons?install=${encodeURIComponent(url)}`;
    });
    setupBackButton(() => {
      const atHome = ['', '#', '#/'].includes(location.hash);
      if (!atHome) history.back();
      return !atHome;
    });
  }, [bootstrap]);

  useEffect(() => {
    document.documentElement.lang = lang;
    document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';
  }, [lang]);

  return (
    <HashRouter>
      <Layout />
    </HashRouter>
  );
}
