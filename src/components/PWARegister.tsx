'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { Download, WifiOff, RefreshCw } from 'lucide-react';

export function PWARegister() {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isInstallable, setIsInstallable] = useState(false);
  const [isOffline, setIsOffline] = useState(false);
  const [hasUpdate, setHasUpdate] = useState(false);

  useEffect(() => {
    // 检查网络状态
    const handleOnline = () => {
      setIsOffline(false);
      toast.success('网络已恢复');
    };
    const handleOffline = () => {
      setIsOffline(true);
      toast.warning('进入离线模式，部分功能可能受限');
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    setIsOffline(!navigator.onLine);

    // 安装提示
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setIsInstallable(true);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    // 注册 Service Worker
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker
        .register('/sw.js')
        .then((registration) => {
          console.log('SW 注册成功:', registration);

          // 检查更新
          registration.addEventListener('updatefound', () => {
            const newWorker = registration.installing;
            if (newWorker) {
              newWorker.addEventListener('statechange', () => {
                if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                  setHasUpdate(true);
                  toast.info('发现新版本，点击刷新更新', {
                    action: {
                      label: '刷新',
                      onClick: () => window.location.reload(),
                    },
                  });
                }
              });
            }
          });
        })
        .catch((error) => {
          console.log('SW 注册失败:', error);
        });

      // 监听消息
      navigator.serviceWorker.addEventListener('message', (event) => {
        if (event.data && event.data.type === 'SW_UPDATE') {
          setHasUpdate(true);
        }
      });
    }

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;

    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;

    if (outcome === 'accepted') {
      toast.success('应用安装成功！');
      setIsInstallable(false);
    }
    setDeferredPrompt(null);
  };

  const handleUpdate = () => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.ready.then((registration) => {
        registration.update();
        window.location.reload();
      });
    }
  };

  // 离线状态指示器
  if (isOffline) {
    return (
      <div className="fixed bottom-4 left-4 z-50">
        <div className="flex items-center gap-2 px-4 py-2 bg-yellow-500/90 text-white rounded-full shadow-lg">
          <WifiOff className="w-4 h-4" />
          <span className="text-sm font-medium">离线模式</span>
        </div>
      </div>
    );
  }

  // 更新提示
  if (hasUpdate) {
    return (
      <div className="fixed bottom-4 right-4 z-50">
        <Button
          onClick={handleUpdate}
          className="gap-2 shadow-lg"
          variant="default"
        >
          <RefreshCw className="w-4 h-4" />
          更新应用
        </Button>
      </div>
    );
  }

  // 安装提示
  if (isInstallable) {
    return (
      <div className="fixed bottom-4 right-4 z-50">
        <Button
          onClick={handleInstall}
          className="gap-2 shadow-lg"
          variant="default"
        >
          <Download className="w-4 h-4" />
          安装应用
        </Button>
      </div>
    );
  }

  return null;
}
