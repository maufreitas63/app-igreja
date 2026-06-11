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
        <h1 className="text-2xl font-bold text-slate-900">Igreja Batista Norte</h1>
        <p className="mt-2 text-sm text-slate-600">
          Ministério de Acolhimento
        </p>
      </header>
      <FamilyRegistrationForm />
    </div>
  </React.StrictMode>
);
