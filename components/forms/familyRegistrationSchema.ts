import {
  FAMILY_DEPENDENT_RELATIONSHIP_OPTIONS,
  FAMILY_REGISTRATION_PHONE_ERROR,
  isValidBrazilMobilePhone,
  parseBrazilianDateToIso,
} from '@/lib/familyRegistration';
import { normalizeCepDigits } from '@/lib/cepUtils';
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

const requiredMobilePhone = z
  .string()
  .trim()
  .min(1, 'Informe o celular.')
  .refine((value) => isValidBrazilMobilePhone(value), {
    message: FAMILY_REGISTRATION_PHONE_ERROR,
  });

const optionalMobilePhone = z
  .string()
  .trim()
  .optional()
  .default('')
  .refine((value) => !value || isValidBrazilMobilePhone(value), {
    message: FAMILY_REGISTRATION_PHONE_ERROR,
  });

const requiredCep = z
  .string()
  .trim()
  .min(1, 'Informe o CEP.')
  .refine((value) => (normalizeCepDigits(value)?.length ?? 0) === 8, {
    message: 'Informe um CEP com 8 dígitos.',
  });

const dependentRelationship = z.enum(FAMILY_DEPENDENT_RELATIONSHIP_OPTIONS, {
  message: 'Selecione o vínculo familiar.',
});

const dependentSchema = z.object({
  fullName: requiredName,
  birthDate: requiredBirthDate,
  relationship: dependentRelationship,
  phone: optionalMobilePhone,
  foodRestrictions: z.string().trim().optional().default(''),
});

export const familyRegistrationSchema = z.object({
  informant: z.object({
    fullName: requiredName,
    birthDate: requiredBirthDate,
    phone: requiredMobilePhone,
    cep: requiredCep,
    addressNumber: z.string().trim().min(1, 'Informe o número do endereço.'),
    addressComplement: z.string().trim().optional().default(''),
    foodRestrictions: z.string().trim().optional().default(''),
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
    foodRestrictions: '',
  },
  dependents: [],
};
