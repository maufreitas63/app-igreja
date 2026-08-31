import { FamilyRegistrationForm } from '@/components/forms/FamilyRegistrationForm';
import '@/global.css';
import {
  FAMILY_REGISTRATION_TENANT_INVALID_MESSAGE,
  FAMILY_REGISTRATION_TENANT_REQUIRED_MESSAGE,
  lookupPublicFamilyChurch,
  type PublicFamilyChurch,
} from '@/lib/familyRegistration';
import { parseInstanceCodeFromUrl } from '@/lib/instanceCode';
import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';

function CadastroFamiliaPage() {
  const [status, setStatus] = useState<'loading' | 'ready' | 'missing' | 'invalid'>('loading');
  const [church, setChurch] = useState<PublicFamilyChurch | null>(null);
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    let active = true;

    void (async () => {
      const code =
        typeof window !== 'undefined' ? parseInstanceCodeFromUrl(window.location.href) : null;

      if (!code) {
        if (active) {
          setStatus('missing');
          setErrorMessage(FAMILY_REGISTRATION_TENANT_REQUIRED_MESSAGE);
        }
        return;
      }

      try {
        const found = await lookupPublicFamilyChurch(code);
        if (!active) {
          return;
        }

        if (!found) {
          setStatus('invalid');
          setErrorMessage(FAMILY_REGISTRATION_TENANT_INVALID_MESSAGE);
          return;
        }

        setChurch(found);
        setStatus('ready');
      } catch {
        if (active) {
          setStatus('invalid');
          setErrorMessage(FAMILY_REGISTRATION_TENANT_INVALID_MESSAGE);
        }
      }
    })();

    return () => {
      active = false;
    };
  }, []);

  return (
    <div className="min-h-screen bg-slate-100 px-4 py-10">
      <header className="mx-auto mb-8 max-w-3xl text-center">
        <h1 className="text-2xl font-bold text-slate-900">Cadastro de Família</h1>
        <p className="mt-2 text-sm text-slate-600">
          {church
            ? `${church.name} — Ministério de Acolhimento`
            : 'Ministério de Acolhimento'}
        </p>
      </header>

      {status === 'loading' ? (
        <p className="mx-auto max-w-xl text-center text-sm text-slate-600">
          Validando o código da igreja…
        </p>
      ) : null}

      {status === 'ready' && church ? (
        <FamilyRegistrationForm tenantCode={church.code} churchName={church.name} />
      ) : null}

      {status === 'missing' || status === 'invalid' ? (
        <div className="mx-auto max-w-xl rounded-xl border border-amber-200 bg-amber-50 p-6 text-center">
          <p className="text-sm text-amber-950">{errorMessage}</p>
        </div>
      ) : null}
    </div>
  );
}

const rootElement = document.getElementById('root');

if (!rootElement) {
  throw new Error('Elemento #root não encontrado.');
}

createRoot(rootElement).render(
  <React.StrictMode>
    <CadastroFamiliaPage />
  </React.StrictMode>
);
