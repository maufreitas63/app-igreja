import { FamilyRegistrationForm } from '@/components/forms/FamilyRegistrationForm';
import '@/global.css';
import React from 'react';
import { createRoot } from 'react-dom/client';

const rootElement = document.getElementById('root');

if (!rootElement) {
  throw new Error('Elemento #root não encontrado.');
}

createRoot(rootElement).render(
  <React.StrictMode>
    <div className="min-h-screen bg-slate-100 px-4 py-10">
      <header className="mx-auto mb-8 max-w-3xl text-center">
        <p className="text-sm font-medium uppercase tracking-wide text-emerald-700">
          Formulário público
        </p>
        <h1 className="mt-2 text-2xl font-bold text-slate-900">Igreja Batista Norte</h1>
        <p className="mt-2 text-sm text-slate-600">
          Página independente do aplicativo da igreja — não é necessário login nem instalar o app.
        </p>
      </header>
      <FamilyRegistrationForm />
    </div>
  </React.StrictMode>
);
