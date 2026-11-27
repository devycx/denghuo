import { Header } from './components/Header';
import { ToastHost } from './components/Toast';
import { Detail } from './pages/Detail';
import { Home } from './pages/Home';
import { Library } from './pages/Library';
import { Live } from './pages/Live';
import { SearchPage } from './pages/Search';
import { Settings } from './pages/Settings';
import { Watch } from './pages/Watch';
import { useRoute } from './router';
import { useStore } from './store';

export function App() {
  const route = useRoute();
  const { config } = useStore();

  let page: React.ReactNode;
  switch (route.path) {
    case '/live':
      page = <Live />;
      break;
    case '/search':
      page = <SearchPage />;
      break;
    case '/detail':
      page = <Detail />;
      break;
    case '/watch':
      page = <Watch />;
      break;
    case '/library':
      page = <Library />;
      break;
    case '/settings':
      page = <Settings />;
      break;
    default:
      page = <Home />;
  }

  return (
    <div className="app">
      <Header />
      <main>{page}</main>
      <footer className="site-footer">
        <span>© {config?.siteName || '灯火影视'}</span>
      </footer>
      <ToastHost />
    </div>
  );
}
