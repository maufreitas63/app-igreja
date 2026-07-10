import { FamilyRegistrationForm } from '@/components/forms/FamilyRegistrationForm';
import '@/global.css';
import { supabaseBrowser } from '@/lib/supabaseBrowser';
import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';

function CadastroFamiliaHeader() {
  const [entityName, setEntityName] = useState('');

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const { data } = await supabaseBrowser.rpc('get_app_parameter_value', {
          p_parameter: 'Nome_Entidade',
        });
        if (active && typeof data === 'string' && data.trim()) {
          setEntityName(data.trim());
        }
      } catch {
        // mantém título genérico
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  return (
    <header className="mx-auto mb-8 max-w-3xl text-center">
      <h1 className="text-2xl font-bold text-slate-900">Cadastro de Família</h1>
      <p className="mt-2 text-sm text-slate-600">
        {entityName ? `${entityName} — Ministério de Acolhimento` : 'Ministério de Acolhimento'}
      </p>
    </header>
  );
}

const rootElement = document.getElementById('root');

if (!rootElement) {
  throw new Error('Elemento #root não encontrado.');
}

createRoot(rootElement).render(
  <React.StrictMode>
    <div className="min-h-screen bg-slate-100 px-4 py-10">
      <CadastroFamiliaHeader />
      <FamilyRegistrationForm />
    </div>
  </React.StrictMode>
);
