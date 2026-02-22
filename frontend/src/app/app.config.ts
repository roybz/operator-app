import {
  ApplicationConfig,
  importProvidersFrom,
  provideBrowserGlobalErrorListeners,
} from '@angular/core';
import { provideHttpClient, withFetch, HttpClient } from '@angular/common/http';
import { provideRouter } from '@angular/router';

import { routes } from './app.routes';
import { provideClientHydration, withEventReplay } from '@angular/platform-browser';
import { TranslateLoader, TranslateModule } from '@ngx-translate/core';
import { TranslateHttpLoader } from '@ngx-translate/http-loader';
import { STORAGE_ADAPTER } from './core/storage/storage-adapter';
import { LocalStorageAdapter } from './core/storage/local-storage.adapter';
import { RemoteStorageAdapter } from './core/storage/remote-storage.adapter';
import { APP_INITIALIZER } from '@angular/core';
import { AuthService } from './core/auth.service';
import { DialogService } from './core/dialog.service';
import { StorageService } from './core/storage/storage.service';
import { CognitoOidcService } from './core/auth/cognito-oidc.service';
import { getOpConfig } from './core/op-config';

export function httpLoaderFactory(http: HttpClient) {
  return new TranslateHttpLoader(http, '/assets/i18n/', '.json');
}

const resolveStorageAdapter = (cognitoOidc: CognitoOidcService) => {
  const config = getOpConfig();
  const storageMode = config['storageMode'];
  if (storageMode !== 'remote') return new LocalStorageAdapter();
  const baseUrl = String(config['storageApiBaseUrl'] ?? config['apiBaseUrl'] ?? '').replace(
    /\/$/,
    '',
  );
  return new RemoteStorageAdapter(baseUrl, {
    accessTokenProvider: () => cognitoOidc.getAccessToken(),
    localFallback: new LocalStorageAdapter(),
  });
};

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes),
    provideClientHydration(withEventReplay()),
    provideHttpClient(withFetch()),
    importProvidersFrom(
      TranslateModule.forRoot({
        defaultLanguage: 'en',
        loader: {
          provide: TranslateLoader,
          useFactory: httpLoaderFactory,
          deps: [HttpClient],
        },
      }),
    ),
    { provide: STORAGE_ADAPTER, useFactory: resolveStorageAdapter, deps: [CognitoOidcService] },
    {
      provide: APP_INITIALIZER,
      multi: true,
      deps: [CognitoOidcService, StorageService, AuthService, DialogService],
      useFactory: (
        cognitoOidc: CognitoOidcService,
        storage: StorageService,
        auth: AuthService,
        dialog: DialogService,
      ) => {
        return async () => {
          await cognitoOidc.completeRedirectIfNeeded();
          await storage.hydrate();
          await auth.hydrate();
          await dialog.hydrate();
        };
      },
    },
  ],
};
