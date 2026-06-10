import { Button } from '@/components/ui/button';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import {
  buildFamilyRegistrationShareUrl,
  buildFamilyRegistrationWhatsAppUrl,
  FAMILY_DEPENDENT_RELATIONSHIP_OPTIONS,
  FAMILY_INFORMANT_RELATIONSHIP,
  formatPhoneDisplay,
  submitFamilyRegistration,
  type FamilyDependentRelationship,
  type FamilyRegistrationFormValues,
} from '@/lib/familyRegistration';
import { zodResolver } from '@hookform/resolvers/zod';
import React, { useState } from 'react';
import { useFieldArray, useForm } from 'react-hook-form';
import {
  familyRegistrationDefaultValues,
  familyRegistrationSchema,
  type FamilyRegistrationSchemaValues,
} from './familyRegistrationSchema';

const formatDateInput = (value: string) => {
  const cleaned = value.replace(/\D/g, '').slice(0, 8);
  if (cleaned.length <= 2) return cleaned;
  if (cleaned.length <= 4) return `${cleaned.slice(0, 2)}/${cleaned.slice(2)}`;
  return `${cleaned.slice(0, 2)}/${cleaned.slice(2, 4)}/${cleaned.slice(4)}`;
};

const relationshipButtonClass = (selected: boolean) =>
  [
    'rounded-md border px-3 py-2 text-sm font-medium transition-colors',
    selected
      ? 'border-emerald-600 bg-emerald-600 text-white'
      : 'border-slate-300 bg-white text-slate-700 hover:border-emerald-500',
  ].join(' ');

const formatCepInput = (value: string) => {
  const cleaned = value.replace(/\D/g, '').slice(0, 8);
  if (cleaned.length <= 5) return cleaned;
  return `${cleaned.slice(0, 5)}-${cleaned.slice(5)}`;
};

type SubmitState = 'idle' | 'success' | 'error';

export function FamilyRegistrationForm() {
  const [submitState, setSubmitState] = useState<SubmitState>('idle');
  const [feedbackMessage, setFeedbackMessage] = useState('');
  const [registeredFamilyId, setRegisteredFamilyId] = useState<string | null>(null);
  const [copyHint, setCopyHint] = useState('');

  const form = useForm<FamilyRegistrationSchemaValues>({
    resolver: zodResolver(familyRegistrationSchema),
    defaultValues: familyRegistrationDefaultValues,
    mode: 'onBlur',
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: 'dependents',
  });

  const isSubmitting = form.formState.isSubmitting;
  const canAddDependent = fields.length < 9;

  const onSubmit = async (values: FamilyRegistrationSchemaValues) => {
    setSubmitState('idle');
    setFeedbackMessage('');

    try {
      const payload: FamilyRegistrationFormValues = {
        informant: values.informant,
        dependents: values.dependents,
      };

      const result = await submitFamilyRegistration(payload);
      setRegisteredFamilyId(result.familyId);
      setSubmitState('success');
      setFeedbackMessage(
        `Cadastro recebido com sucesso! ${result.insertedCount} perfil(is) gravado(s) no grupo familiar.`
      );
      form.reset(familyRegistrationDefaultValues);
    } catch (error) {
      setSubmitState('error');
      const message =
        error instanceof Error
          ? error.message
          : 'Não foi possível enviar o cadastro. Tente novamente ou fale com a secretaria.';
      setFeedbackMessage(message);
    }
  };

  const handleCopyLink = async () => {
    const url = buildFamilyRegistrationShareUrl();
    if (!url) {
      setCopyHint('URL indisponível neste ambiente.');
      return;
    }

    try {
      await navigator.clipboard.writeText(url);
      setCopyHint('Link copiado para a área de transferência.');
    } catch {
      setCopyHint('Não foi possível copiar o link.');
    }
  };

  const handleShareWhatsApp = () => {
    const url = buildFamilyRegistrationShareUrl();
    if (!url) {
      setCopyHint('URL indisponível para compartilhar.');
      return;
    }

    const waUrl = buildFamilyRegistrationWhatsAppUrl(url);
    window.open(waUrl, '_blank', 'noopener,noreferrer');
  };

  if (submitState === 'success') {
    return (
      <div className="mx-auto w-full max-w-2xl rounded-xl border bg-white p-8 shadow-sm">
        <h2 className="text-2xl font-semibold text-slate-900">Obrigado pelo cadastro!</h2>
        <p className="mt-3 text-slate-600">
          Agradecemos por registrar sua família. Nossa equipe dará continuidade ao acolhimento.
        </p>
        {registeredFamilyId ? (
          <p className="mt-2 text-sm text-slate-500">
            Código da família: <span className="font-mono">{registeredFamilyId}</span>
          </p>
        ) : null}
        <p className="mt-4 text-sm text-slate-600">{feedbackMessage}</p>

        <div className="mt-6 flex flex-col gap-3 sm:flex-row">
          <Button type="button" variant="outline" onClick={handleCopyLink}>
            Copiar Link
          </Button>
          <Button type="button" onClick={handleShareWhatsApp}>
            Enviar via WhatsApp
          </Button>
        </div>

        {copyHint ? <p className="mt-3 text-sm text-emerald-700">{copyHint}</p> : null}

        <Button
          type="button"
          variant="ghost"
          className="mt-6"
          onClick={() => {
            setSubmitState('idle');
            setRegisteredFamilyId(null);
            setCopyHint('');
          }}
        >
          Cadastrar outra família
        </Button>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-3xl rounded-xl border bg-white p-6 shadow-sm sm:p-8">
      <header className="mb-8 space-y-2">
        <h1 className="text-2xl font-bold text-slate-900">Cadastro de Família</h1>
        <p className="text-sm text-slate-600">
          Preencha os dados do informante principal e adicione até 9 dependentes (máximo de 10 pessoas).
        </p>
      </header>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-10">
          <section className="space-y-4">
            <h2 className="text-lg font-semibold text-slate-900">Informante principal</h2>
            <p className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-900">
              Vínculo familiar: <strong>{FAMILY_INFORMANT_RELATIONSHIP}</strong>
            </p>

            <div className="grid gap-4 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="informant.fullName"
                render={({ field }) => (
                  <FormItem className="sm:col-span-2">
                    <FormLabel>Nome completo</FormLabel>
                    <FormControl>
                      <Input placeholder="Nome e sobrenome" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="informant.birthDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Data de nascimento</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="dd/mm/aaaa"
                        inputMode="numeric"
                        {...field}
                        onChange={(event) => field.onChange(formatDateInput(event.target.value))}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="informant.phone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Celular</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="(00) 00000-0000"
                        inputMode="tel"
                        {...field}
                        onChange={(event) => field.onChange(formatPhoneDisplay(event.target.value))}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="informant.cep"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>CEP</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="00000-000"
                        inputMode="numeric"
                        {...field}
                        onChange={(event) => field.onChange(formatCepInput(event.target.value))}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="informant.addressNumber"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Número</FormLabel>
                    <FormControl>
                      <Input placeholder="Nº" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="informant.addressComplement"
                render={({ field }) => (
                  <FormItem className="sm:col-span-2">
                    <FormLabel>Complemento</FormLabel>
                    <FormControl>
                      <Input placeholder="Apto, bloco, referência (opcional)" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="informant.foodRestrictions"
                render={({ field }) => (
                  <FormItem className="sm:col-span-2">
                    <FormLabel>Restrições alimentares</FormLabel>
                    <FormControl>
                      <Input placeholder="Alergias, intolerâncias (opcional)" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          </section>

          <section className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-lg font-semibold text-slate-900">Dependentes</h2>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={!canAddDependent || isSubmitting}
                onClick={() =>
                  append({
                    fullName: '',
                    birthDate: '',
                    relationship: 'Filho(a)',
                    phone: '',
                    foodRestrictions: '',
                  })
                }
              >
                Adicionar dependente
              </Button>
            </div>

            {fields.length === 0 ? (
              <p className="text-sm text-slate-500">
                Nenhum dependente adicionado. Use o botão acima se houver mais integrantes na família.
              </p>
            ) : null}

            {fields.map((fieldItem, index) => (
              <div
                key={fieldItem.id}
                className="space-y-4 rounded-lg border border-slate-200 bg-slate-50 p-4"
              >
                <div className="flex items-center justify-between gap-3">
                  <h3 className="text-sm font-semibold text-slate-800">Dependente {index + 1}</h3>
                  <Button
                    type="button"
                    variant="destructive"
                    size="sm"
                    disabled={isSubmitting}
                    onClick={() => remove(index)}
                  >
                    Remover
                  </Button>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <FormField
                    control={form.control}
                    name={`dependents.${index}.fullName`}
                    render={({ field }) => (
                      <FormItem className="sm:col-span-2">
                        <FormLabel>Nome completo</FormLabel>
                        <FormControl>
                          <Input placeholder="Nome e sobrenome" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name={`dependents.${index}.relationship`}
                    render={({ field }) => (
                      <FormItem className="sm:col-span-2">
                        <FormLabel>Vínculo familiar</FormLabel>
                        <FormControl>
                          <div className="flex flex-wrap gap-2">
                            {FAMILY_DEPENDENT_RELATIONSHIP_OPTIONS.map((option) => (
                              <button
                                key={option}
                                type="button"
                                className={relationshipButtonClass(field.value === option)}
                                onClick={() => field.onChange(option as FamilyDependentRelationship)}
                              >
                                {option}
                              </button>
                            ))}
                          </div>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name={`dependents.${index}.birthDate`}
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Data de nascimento</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="dd/mm/aaaa"
                            inputMode="numeric"
                            {...field}
                            onChange={(event) => field.onChange(formatDateInput(event.target.value))}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name={`dependents.${index}.phone`}
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Celular</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="(00) 00000-0000"
                            inputMode="tel"
                            {...field}
                            onChange={(event) => field.onChange(formatPhoneDisplay(event.target.value))}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name={`dependents.${index}.foodRestrictions`}
                    render={({ field }) => (
                      <FormItem className="sm:col-span-2">
                        <FormLabel>Restrições alimentares</FormLabel>
                        <FormControl>
                          <Input placeholder="Alergias, intolerâncias (opcional)" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </div>
            ))}
          </section>

          {submitState === 'error' && feedbackMessage ? (
            <p className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {feedbackMessage}
            </p>
          ) : null}

          <Button type="submit" className="w-full sm:w-auto" disabled={isSubmitting}>
            {isSubmitting ? 'Enviando cadastro…' : 'Enviar cadastro familiar'}
          </Button>
        </form>
      </Form>
    </div>
  );
}
