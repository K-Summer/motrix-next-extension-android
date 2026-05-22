import { browser } from 'wxt/browser';
import {
  createExternalProtocolClickHandler,
  type ExternalProtocol,
} from '@/lib/services';
import { parseDownloadSettings } from '@/lib/storage';
import { detectDownloadLink } from '@/lib/download';
import { DEFAULT_DOWNLOAD_SETTINGS } from '@/shared/constants';
import type { InterceptionScope } from '@/shared/types';

export default defineContentScript({
  matches: ['<all_urls>'],
  runAt: 'document_idle',

  main() {
    let interceptionEnabled = DEFAULT_DOWNLOAD_SETTINGS.enabled;
    let interceptionScope: InterceptionScope = { ...DEFAULT_DOWNLOAD_SETTINGS.interceptionScope };

    async function refreshInterceptionState(): Promise<void> {
      const data = await browser.storage.local.get('settings');
      const settings = parseDownloadSettings(data.settings);
      interceptionEnabled = settings.enabled;
      interceptionScope = settings.interceptionScope;
    }

    void refreshInterceptionState();

    browser.storage.onChanged.addListener((changes, area) => {
      if (area !== 'local' || !changes.settings) return;
      const settings = parseDownloadSettings(changes.settings.newValue);
      interceptionEnabled = settings.enabled;
      interceptionScope = settings.interceptionScope;
    });

    const handleProtocolClick = createExternalProtocolClickHandler({
      shouldIntercept: (link) => interceptionEnabled && interceptionScope[link.protocol],
      sendProtocol: ({ protocol, url }: { protocol: ExternalProtocol; url: string }) => {
        void browser.runtime.sendMessage({ type: 'HANDLE_EXTERNAL_PROTOCOL', protocol, url });
      },
    });

    function handleDownloadClick(event: MouseEvent): void {
      if (!interceptionEnabled || !interceptionScope.browserDownloads) return;

      const detected = detectDownloadLink(event.target as Element);
      if (!detected) return;

      if (detected.reason === 'protocol') {
        return;
      }

      event.preventDefault();
      event.stopPropagation();

      void browser.runtime.sendMessage({
        type: 'HANDLE_CONTENT_DOWNLOAD',
        url: detected.url,
        sourceUrl: window.location.href,
        reason: detected.reason,
      });
    }

    document.addEventListener('click', handleProtocolClick, true);
    document.addEventListener('click', handleDownloadClick, true);
  },
});