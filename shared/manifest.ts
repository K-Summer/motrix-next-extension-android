export type ExtensionBrowser = 'chromium' | 'firefox' | 'firefox-android' | string;

export interface ExtensionManifest {
  name: string;
  version?: string;
  description: string;
  default_locale: string;
  permissions: string[];
  optional_permissions: string[];
  host_permissions: string[];
  optional_host_permissions: string[];
  browser_specific_settings?: {
    gecko?: {
      id: string;
      strict_min_version: string;
      data_collection_permissions?: {
        required: string[];
      };
    };
  };
}

const DESKTOP_PERMISSIONS = [
  'downloads',
  'storage',
  'contextMenus',
  'notifications',
  'webRequest',
  'cookies',
] as const;

/**
 * Firefox Android does not support `downloads`, `webRequest`, `cookies`,
 * or `contextMenus`. These APIs are silently absent.
 * `scripting` is needed for content script injection.
 */
const ANDROID_PERMISSIONS = ['storage'] as const;

const LOOPBACK_HOST_PERMISSIONS = ['http://127.0.0.1/*', 'http://localhost/*'] as const;
const BROAD_DOWNLOAD_ORIGINS = ['https://*/*', 'http://*/*'] as const;

export function buildExtensionManifest(
  browser: ExtensionBrowser,
  opts?: { android?: boolean },
): ExtensionManifest {
  const isFirefoxAndroid = browser === 'firefox' && opts?.android;
  const isFirefox = browser === 'firefox' || browser === 'firefox-android';
  const optionalPermissions = isFirefox ? [] : ['downloads.ui'];

  const permissions = isFirefoxAndroid
    ? [...ANDROID_PERMISSIONS]
    : [...DESKTOP_PERMISSIONS];

  return {
    name: isFirefoxAndroid ? '__MSG_ext_name_android__' : '__MSG_ext_name__',
    description: '__MSG_ext_description__',
    default_locale: 'en',
    permissions,
    optional_permissions: optionalPermissions,
    host_permissions: [...LOOPBACK_HOST_PERMISSIONS, ...BROAD_DOWNLOAD_ORIGINS],
    optional_host_permissions: [],
    ...(isFirefox
      ? {
          browser_specific_settings: {
            gecko: {
              id: 'motrix-next-extension@aninsomniacy.dev',
              strict_min_version: '128.0',
              ...(isFirefoxAndroid
                ? {}
                : {
                    data_collection_permissions: {
                      required: ['none'],
                    },
                  }),
            },
          },
        }
      : {}),
  };
}