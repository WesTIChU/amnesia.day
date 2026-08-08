import { useState, useEffect } from 'react';
import { HomeView } from './components/HomeView';
import { MemoryCardView } from './components/MemoryCardView';
import { ArchiveView } from './components/ArchiveView';
import { MachineView } from './components/MachineView';
import { AboutView } from './components/AboutView';
import { TermsView } from './components/TermsView';
import { PrivacyView } from './components/PrivacyView';
import { FaqView } from './components/FaqView';
import { OpenArchiveModal } from './components/OpenArchiveModal';
import { createV2MemoryKey, deriveV2AuthVerifier, deriveV2LookupVerifier } from './lib/crypto';

const SESSION_STORAGE_KEY = 'amnesia_active_session';

function getStoredSession(): { activeKey: string; keyCreatedAt: string } {
  try {
    const raw = sessionStorage.getItem(SESSION_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed.activeKey === 'string' && parsed.activeKey.length > 0) {
        return {
          activeKey: parsed.activeKey,
          keyCreatedAt: typeof parsed.keyCreatedAt === 'string' ? parsed.keyCreatedAt : ''
        };
      }
    }
  } catch {}
  return { activeKey: '', keyCreatedAt: '' };
}

function persistSession(activeKey: string, keyCreatedAt: string): void {
  try {
    sessionStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify({ activeKey, keyCreatedAt }));
  } catch {}
}

function clearStoredSession(): void {
  try {
    sessionStorage.removeItem(SESSION_STORAGE_KEY);
  } catch {}
}

export default function App() {
  const [currentView, setCurrentView] = useState<'home' | 'card' | 'archive' | 'machine' | 'terms' | 'privacy' | 'about' | 'faq'>('home');
  const [activeKey, setActiveKey] = useState<string>(() => getStoredSession().activeKey);
  const [keyCreatedAt, setKeyCreatedAt] = useState<string>(() => getStoredSession().keyCreatedAt);
  const [isOpenModalOpen, setIsOpenModalOpen] = useState<boolean>(false);
  const [isCreatingKey, setIsCreatingKey] = useState(false);

  // Sync route with window.location.pathname
  useEffect(() => {
    const handleLocationChange = () => {
      const path = window.location.pathname;

      if (path === '/vault') {
        setCurrentView('archive');
      } else if (path === '/machine') {
        setCurrentView('machine');
      } else if (path === '/terms') {
        setCurrentView('terms');
      } else if (path === '/privacy') {
        setCurrentView('privacy');
      } else if (path === '/about') {
        setCurrentView('about');
      } else if (path === '/faq') {
        setCurrentView('faq');
      } else {
        setCurrentView('home');
        if (path === '/card') window.history.replaceState({}, '', '/');
      }
    };

    handleLocationChange();

    window.addEventListener('popstate', handleLocationChange);
    return () => window.removeEventListener('popstate', handleLocationChange);
  }, []);

  // Every view change (link clicks, logging in, creating a key, browser
  // back/forward) should land at the top of the page.
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [currentView]);

  useEffect(() => {
    const path = window.location.pathname;
    const metadata: Record<string, { title: string; description: string }> = {
      '/': {
        title: 'Amnesia | Private One-Year Memory Archive',
        description: 'Amnesia is a private one-year memory archive. Write a memory, encrypt it in your browser, and return when it awakens 365 days later.',
      },
      '/about': {
        title: 'About Amnesia | A One-Year Memory Archive',
        description: 'Learn how Amnesia protects private memories with browser encryption, a server-enforced one-year release, and no personal data collection.',
      },
      '/faq': {
        title: 'Archive Questions | Amnesia',
        description: 'Answers about Amnesia memory encryption, Recovery Phrases, one-year awakening, the Timekeeper, and archive deletion.',
      },
      '/privacy': {
        title: 'Privacy | Amnesia',
        description: 'Amnesia collects no personal data and encrypts memories in your browser before they reach the archive.',
      },
      '/terms': {
        title: 'Terms of Service | Amnesia',
        description: 'Read the Amnesia Vault Protocol terms for browser-encrypted, one-year-release memories and Recovery Phrase access.',
      },
    };
    const page = metadata[path] || metadata['/'];
    const isPrivateRoute = path === '/vault' || path === '/card';
    const canonicalPath = isPrivateRoute ? '/' : path;

    document.title = page.title;
    document.querySelector('meta[name="description"]')?.setAttribute('content', page.description);
    document.querySelector('meta[name="robots"]')?.setAttribute(
      'content',
      isPrivateRoute ? 'noindex, nofollow, noarchive' : 'index, follow, max-image-preview:large',
    );
    document.querySelector('link[rel="canonical"]')?.setAttribute('href', `https://amnesia.day${canonicalPath}`);
    document.querySelector('meta[property="og:title"]')?.setAttribute('content', page.title);
    document.querySelector('meta[property="og:description"]')?.setAttribute('content', page.description);
    document.querySelector('meta[property="og:url"]')?.setAttribute('content', `https://amnesia.day${canonicalPath}`);
    document.querySelector('meta[name="twitter:title"]')?.setAttribute('content', page.title);
    document.querySelector('meta[name="twitter:description"]')?.setAttribute('content', page.description);
  }, [currentView]);

  const handleCreateKey = async () => {
    if (isCreatingKey) return;

    setIsCreatingKey(true);
    try {
      const generated = createV2MemoryKey();
      const auth = await deriveV2AuthVerifier(generated.key, generated.authSalt);
      const lookupVerifier = await deriveV2LookupVerifier(generated.key);
      const res = await fetch('/api/archive/create-v2', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...auth, lookupVerifier })
      });
      const data = await res.json();
      if (res.ok && data.archiveId) {
        setActiveKey(generated.key);
        setKeyCreatedAt(data.createdAt);
        persistSession(generated.key, data.createdAt);
        setCurrentView('card');
        window.history.pushState({}, '', '/vault');
      }
    } catch (err) {
      console.error('Error creating memory key:', err);
    } finally {
      setIsCreatingKey(false);
    }
  };

  const handleEnterArchive = (key: string) => {
    setActiveKey(key);
    persistSession(key, keyCreatedAt);
    setCurrentView('archive');
    if (window.location.pathname !== '/vault') {
      window.history.pushState({}, '', '/vault');
    }
  };

  const handleNavigateMachine = () => {
    setCurrentView('machine');
    if (window.location.pathname !== '/machine') {
      window.history.pushState({}, '', '/machine');
    }
  };

  const handleNavigateTerms = () => {
    setCurrentView('terms');
    if (window.location.pathname !== '/terms') {
      window.history.pushState({}, '', '/terms');
    }
  };

  const handleNavigatePrivacy = () => {
    setCurrentView('privacy');
    if (window.location.pathname !== '/privacy') {
      window.history.pushState({}, '', '/privacy');
    }
  };

  const handleNavigateAbout = () => {
    setCurrentView('about');
    if (window.location.pathname !== '/about') {
      window.history.pushState({}, '', '/about');
    }
  };

  const handleGoHome = () => {
    if (activeKey) {
      setCurrentView('archive');
      if (window.location.pathname !== '/vault') {
        window.history.pushState({}, '', '/vault');
      }
    } else {
      setCurrentView('home');
      if (window.location.pathname !== '/') {
        window.history.pushState({}, '', '/');
      }
    }
  };

  const handleGoSplash = () => {
    setCurrentView('home');
    if (window.location.pathname !== '/') {
      window.history.pushState({}, '', '/');
    }
  };

  const handleSessionClosed = () => {
    setActiveKey('');
    setKeyCreatedAt('');
    clearStoredSession();
    handleGoSplash();
  };

  const handleSessionExpired = () => {
    setActiveKey('');
    setKeyCreatedAt('');
    clearStoredSession();
  };

  return (
    <div className="min-h-screen bg-[#080808] text-[#d1d5db]">
      {currentView === 'home' && (
        <HomeView
          onCreateKey={handleCreateKey}
          isCreatingKey={isCreatingKey}
          onOpenArchiveModal={() => setIsOpenModalOpen(true)}
          onReturnToArchive={() => handleEnterArchive(activeKey)}
          hasActiveSession={Boolean(activeKey)}
          onNavigateMachine={handleNavigateMachine}
          onNavigateTerms={handleNavigateTerms}
          onNavigatePrivacy={handleNavigatePrivacy}
          onNavigateAbout={handleNavigateAbout}
        />
      )}

      {currentView === 'card' && (
        <MemoryCardView
          memoryKey={activeKey || undefined}
          onSessionClosed={handleSessionClosed}
          createdAt={keyCreatedAt}
          onEnterArchive={handleEnterArchive}
          onGoHome={handleGoHome}
        />
      )}

      {currentView === 'archive' && (
        <ArchiveView
          memoryKey={activeKey || undefined}
          onGoHome={handleGoSplash}
          onSessionClosed={handleSessionClosed}
          onSessionExpired={handleSessionExpired}
          onNavigateMachine={handleNavigateMachine}
          onNavigateTerms={handleNavigateTerms}
          onNavigatePrivacy={handleNavigatePrivacy}
          onNavigateAbout={handleNavigateAbout}
        />
      )}

      {currentView === 'machine' && (
        <MachineView
          onGoHome={handleGoHome}
          onNavigateTerms={handleNavigateTerms}
          onNavigatePrivacy={handleNavigatePrivacy}
          onNavigateAbout={handleNavigateAbout}
        />
      )}

      {currentView === 'terms' && (
        <TermsView
          onGoHome={handleGoHome}
          onNavigateTerms={handleNavigateTerms}
          onNavigatePrivacy={handleNavigatePrivacy}
          onNavigateAbout={handleNavigateAbout}
        />
      )}

      {currentView === 'privacy' && (
        <PrivacyView
          onGoHome={handleGoHome}
          onNavigateTerms={handleNavigateTerms}
          onNavigatePrivacy={handleNavigatePrivacy}
          onNavigateAbout={handleNavigateAbout}
        />
      )}

      {currentView === 'about' && (
        <AboutView
          onGoHome={handleGoHome}
          onNavigateTerms={handleNavigateTerms}
          onNavigatePrivacy={handleNavigatePrivacy}
          onNavigateAbout={handleNavigateAbout}
        />
      )}

      {currentView === 'faq' && (
        <FaqView
          onGoHome={handleGoHome}
          onNavigateTerms={handleNavigateTerms}
          onNavigatePrivacy={handleNavigatePrivacy}
          onNavigateAbout={handleNavigateAbout}
        />
      )}

      <OpenArchiveModal
        isOpen={isOpenModalOpen}
        onClose={() => setIsOpenModalOpen(false)}
        onOpenArchive={handleEnterArchive}
      />
    </div>
  );
}
