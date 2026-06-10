import { parseBrazilianDateToIso, normalizePhoneDigits } from '@/lib/familyRegistration';
import { normalizeCepDigits } from '@/lib/geoMapGeocoding';
import { z } from 'zod';

const requiredName = z
  .string()
  .trim()
  .min(3, 'Informe o nome completo (mínimo 3 caracteres).');

const requiredBirthDate = z
  .string()
  .trim()
  .min(1, 'Informe a data de nascimento.')
  .refine((value) => parseBrazilianDateToIso(value) !== null, {
    message: 'Use o formato dd/mm/aaaa com data válida.',
  });

const requiredPhone = z
  .string()
  .trim()
  .min(1, 'Informe o celular.')
  .refine((value) => normalizePhoneDigits(value).length >= 10, {
    message: 'Informe um celular válido com DDD.',
  });

const requiredCep = z
  .string()
  .trim()
  .min(1, 'Informe o CEP.')
  .refine((value) => normalizeCepDigits(value).length === 8, {
    message: 'Informe um CEP com 8 dígitos.',
  });

const dependentSchema = z.object({
  fullName: requiredName,
  birthDate: requiredBirthDate,
  phone: z
    .string()
    .trim()
    .optional()
    .default('')
    .refine((value) => !value || normalizePhoneDigits(value).length >= 10, {
      message: 'Informe um celular válido com DDD.',
    }),
  foodRestrictions: z.string().trim().optional().default(''),
});

export const familyRegistrationSchema = z.object({
  informant: z.object({
    fullName: requiredName,
    birthDate: requiredBirthDate,
    phone: requiredPhone,
    cep: requiredCep,
    addressNumber: z.string().trim().min(1, 'Informe o número do endereço.'),
    addressComplement: z.string().trim().optional().default(''),
  }),
  dependents: z
    .array(dependentSchema)
    .max(9, 'É permitido no máximo 9 dependentes (10 pessoas no total).'),
});

export type FamilyRegistrationSchemaValues = z.infer<typeof familyRegistrationSchema>;

export const familyRegistrationDefaultValues: FamilyRegistrationSchemaValues = {
  informant: {
    fullName: '',
    birthDate: '',
    phone: '',
    cep: '',
    addressNumber: '',
    addressComplement: '',
  },
  dependents: [],
};
