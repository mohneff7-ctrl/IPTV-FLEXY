import { lazy, Suspense, useCallback, useEffect, useState } from 'react';
import { HashRouter, Route, Routes, useLocation } from 'react-router-dom';
import { useSettings } from './store/settings';
import { useAddons } from './store/addons';
import { BottomNav, Drawer, TopBar } from './components/Shell';
import { Spinner, Toaster } from './components/ui';
import { Intro, shouldShowIntro } from './components/Intro';
import { setupBackButton, setupStatusBar } from './lib/native';
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
const Player = lazy(() => import('./player/Player'));

// Decided once per launch (outside React so StrictMode's double render can't consume it).
const PLAY_INTRO = shouldShowIntro(useSettings.getState().showIntro);

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
            <Route path="/settings" element={<Settings />} />
            <Route path="/play" element={<Player />} />
            <Route path="*" element={<Home />} />
          </Routes>
        </Suspense>
      </main>
      {showNav && <BottomNav />}
      <Toaster />
    </div>
  );
}

export default function App() {
  const lang = useSettings((s) => s.lang);
  const bootstrap = useAddons((s) => s.bootstrap);
  const [intro, setIntro] = useState(PLAY_INTRO);
  const endIntro = useCallback(() => setIntro(false), []);

  useEffect(() => {
    bootstrap();
    setupStatusBar();
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
      {intro && <Intro onDone={endIntro} />}
    </HashRouter>
  );
}
