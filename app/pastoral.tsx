import {
  buildPastoralRequestPayload,
  buildPastoralValidationAlertMessage,
  findPastoralRequestMissingField,
  getSupabaseErrorMessage,
  PASTORAL_BENEFICIARY_META,
  PASTORAL_BENEFICIARY_TYPES,
  PASTORAL_DESTINATION_META,
  PASTORAL_DESTINATIONS,
  resolvePastoralSessionProfile,
  submitPastoralRequest,
  type PastoralBeneficiaryType,
  type PastoralRequestDestination,
} from '@/lib/pastoralRequest';
import { SectionLabel } from '@/components/ui/SectionLabel';
import { SegmentChipRow } from '@/components/ui/SegmentChipRow';
import { appAlert } from '@/lib/appAlert';
import { confirmDialog } from '@/lib/confirmDialog';
import { ACCESS_SCREEN, sessionHasAccess } from '@/lib/accessControl';
import { supabase } from '@/lib/supabase';
import { ScreenAccessGate } from '@/components/ScreenAccessGate';
import { useScreenAccessGuard } from '@/hooks/useScreenAccessGuard';
import { FontAwesome } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import {
  buildReturnToDashboardHref,
  resolveReturnDashboardCardParam,
} from '@/lib/dashboardReturnNavigation';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

type PastoralCategory = {
  id: string;
  label: string;
  display_order: number;
};

type PastoralSubcategory = {
  id: string;
  category_id: string;
  label: string;
  display_order: number;
};

type SelectorKind = 'motivo' | 'submotivo' | null;
const FALLBACK_CATEGORIES: PastoralCategory[] = [
  { id: '10000000-0000-4000-8000-000000000001', label: 'Saúde e Bem-Estar Físico e Emocional', display_order: 1 },
  { id: '10000000-0000-4000-8000-000000000002', label: 'Família e Relacionamentos', display_order: 2 },
  { id: '10000000-0000-4000-8000-000000000003', label: 'Vida Profissional, Acadêmica e Financeira', display_order: 3 },
  { id: '10000000-0000-4000-8000-000000000004', label: 'Vida Espiritual, Ministério e Liderança', display_order: 4 },
  { id: '10000000-0000-4000-8000-000000000005', label: 'Ações de Graças, Louvor e Testemunhos', display_order: 5 },
];

const FALLBACK_SUBCATEGORIES: PastoralSubcategory[] = [
  { id: '20000000-0000-4000-8000-000000000001', category_id: '10000000-0000-4000-8000-000000000001', label: 'Enfermidades Graves e Diagnósticos Críticos', display_order: 1 },
  { id: '20000000-0000-4000-8000-000000000002', category_id: '10000000-0000-4000-8000-000000000001', label: 'Intervenções Cirúrgicas e Procedimentos Médicos Complexos', display_order: 2 },
  { id: '20000000-0000-4000-8000-000000000003', category_id: '10000000-0000-4000-8000-000000000001', label: 'Internações Hospitalares e Pacientes em UTI', display_order: 3 },
  { id: '20000000-0000-4000-8000-000000000004', category_id: '10000000-0000-4000-8000-000000000001', label: 'Tratamentos Oncológicos e Quimioterapia', display_order: 4 },
  { id: '20000000-0000-4000-8000-000000000005', category_id: '10000000-0000-4000-8000-000000000001', label: 'Sequelas e Processos de Reabilitação Física', display_order: 5 },
  { id: '20000000-0000-4000-8000-000000000006', category_id: '10000000-0000-4000-8000-000000000001', label: 'Transtornos de Ansiedade, Crises de Pânico e Depressão', display_order: 6 },
  { id: '20000000-0000-4000-8000-000000000007', category_id: '10000000-0000-4000-8000-000000000001', label: 'Esgotamento Psicológico e Síndrome de Burnout', display_order: 7 },
  { id: '20000000-0000-4000-8000-000000000008', category_id: '10000000-0000-4000-8000-000000000001', label: 'Distúrbios de Sono, Insônia e Saúde Psicossomática', display_order: 8 },
  { id: '20000000-0000-4000-8000-000000000009', category_id: '10000000-0000-4000-8000-000000000001', label: 'Dependências Químicas, Alcoolismo e Vícios em Geral', display_order: 9 },
  { id: '20000000-0000-4000-8000-000000000010', category_id: '10000000-0000-4000-8000-000000000001', label: 'Envelhecimento, Doenças Degenerativas e Cuidados Paliativos', display_order: 10 },
  { id: '20000000-0000-4000-8000-000000000011', category_id: '10000000-0000-4000-8000-000000000001', label: 'Conforto no Luto e Consolo para Famílias Enlutadas', display_order: 11 },
  { id: '20000000-0000-4000-8000-000000000012', category_id: '10000000-0000-4000-8000-000000000002', label: 'Crises Conjugais, Esfriamento Afetivo e Ameaças de Divórcio', display_order: 1 },
  { id: '20000000-0000-4000-8000-000000000013', category_id: '10000000-0000-4000-8000-000000000002', label: 'Processos de Separação, Litígios Judiciais e Guarda de Filhos', display_order: 2 },
  { id: '20000000-0000-4000-8000-000000000014', category_id: '10000000-0000-4000-8000-000000000002', label: 'Reconciliação Familiar e Restauração de Vínculos Rompidos', display_order: 3 },
  { id: '20000000-0000-4000-8000-000000000015', category_id: '10000000-0000-4000-8000-000000000002', label: 'Conflitos de Geração e Comunicação entre Pais e Filhos', display_order: 4 },
  { id: '20000000-0000-4000-8000-000000000016', category_id: '10000000-0000-4000-8000-000000000002', label: 'Rebeldia na Adolescência e Condutas de Risco de Jovens', display_order: 5 },
  { id: '20000000-0000-4000-8000-000000000017', category_id: '10000000-0000-4000-8000-000000000002', label: 'Filhos Afastados da Fé e Desviados dos Caminhos da Igreja', display_order: 6 },
  { id: '20000000-0000-4000-8000-000000000018', category_id: '10000000-0000-4000-8000-000000000002', label: 'Proteção de Crianças contra Más Influências e Abusos', display_order: 7 },
  { id: '20000000-0000-4000-8000-000000000019', category_id: '10000000-0000-4000-8000-000000000002', label: 'Mulheres Tentantes e Histórico de Abortos Espontâneos', display_order: 8 },
  { id: '20000000-0000-4000-8000-000000000020', category_id: '10000000-0000-4000-8000-000000000002', label: 'Gestações de Risco e Saúde Materno-Infantil no Parto', display_order: 9 },
  { id: '20000000-0000-4000-8000-000000000021', category_id: '10000000-0000-4000-8000-000000000002', label: 'Desafios com Parentes Agregados e Convivência Familiar Alargada', display_order: 10 },
  { id: '20000000-0000-4000-8000-000000000022', category_id: '10000000-0000-4000-8000-000000000003', label: 'Perda de Emprego, Desemprego Prolongado e Recolocação de Mercado', display_order: 1 },
  { id: '20000000-0000-4000-8000-000000000023', category_id: '10000000-0000-4000-8000-000000000003', label: 'Transição de Carreira, Mudança de Profissão e Demissões', display_order: 2 },
  { id: '20000000-0000-4000-8000-000000000024', category_id: '10000000-0000-4000-8000-000000000003', label: 'Processos Seletivos, Entrevistas de Emprego e Concursos Públicos', display_order: 3 },
  { id: '20000000-0000-4000-8000-000000000025', category_id: '10000000-0000-4000-8000-000000000003', label: 'Sobrecarga de Trabalho, Conflitos com Chefias e Assédio no Ambiente Laboral', display_order: 4 },
  { id: '20000000-0000-4000-8000-000000000026', category_id: '10000000-0000-4000-8000-000000000003', label: 'Endividamento Crítico, Falência de Negócios e Inadimplência', display_order: 5 },
  { id: '20000000-0000-4000-8000-000000000027', category_id: '10000000-0000-4000-8000-000000000003', label: 'Causas Jurídicas Trabalhistas, Cíveis e Processos de Inventário', display_order: 6 },
  { id: '20000000-0000-4000-8000-000000000028', category_id: '10000000-0000-4000-8000-000000000003', label: 'Provisão do Sustento Básico, Escassez de Alimentos e Recursos', display_order: 7 },
  { id: '20000000-0000-4000-8000-000000000029', category_id: '10000000-0000-4000-8000-000000000003', label: 'Vestibulares, Exames Nacionais e Escolhas de Cursos Universitários', display_order: 8 },
  { id: '20000000-0000-4000-8000-000000000030', category_id: '10000000-0000-4000-8000-000000000003', label: 'Conclusão de Graduações, Pós-Graduações e Monografias', display_order: 9 },
  { id: '20000000-0000-4000-8000-000000000031', category_id: '10000000-0000-4000-8000-000000000003', label: 'Gestão e Sabedoria para Empresários, Comerciantes e Autônomos', display_order: 10 },
  { id: '20000000-0000-4000-8000-000000000032', category_id: '10000000-0000-4000-8000-000000000004', label: 'Desânimo Espiritual, Crises de Fé, Dúvidas e Frieza na Devoção', display_order: 1 },
  { id: '20000000-0000-4000-8000-000000000033', category_id: '10000000-0000-4000-8000-000000000004', label: 'Pecados de Estimação, Fortalezas Mentais e Luta contra a Carne', display_order: 2 },
  { id: '20000000-0000-4000-8000-000000000034', category_id: '10000000-0000-4000-8000-000000000004', label: 'Disciplinas Espirituais, Leitura Bíblica Consistente e Vida de Oração', display_order: 3 },
  { id: '20000000-0000-4000-8000-000000000035', category_id: '10000000-0000-4000-8000-000000000004', label: 'Descoberta de Dons, Vocação Ministerial e Chamado Pastoral', display_order: 4 },
  { id: '20000000-0000-4000-8000-000000000036', category_id: '10000000-0000-4000-8000-000000000004', label: 'Proteção Integral, Saúde e Sabedoria para o Pastor Titular e Auxiliares', display_order: 5 },
  { id: '20000000-0000-4000-8000-000000000037', category_id: '10000000-0000-4000-8000-000000000004', label: 'Sustento Emocional e Espiritual para Cônjuges e Filhos de Pastores', display_order: 6 },
  { id: '20000000-0000-4000-8000-000000000038', category_id: '10000000-0000-4000-8000-000000000004', label: 'Unidade, Alinhamento de Visão e Proteção contra Divisões na Liderança', display_order: 7 },
  { id: '20000000-0000-4000-8000-000000000039', category_id: '10000000-0000-4000-8000-000000000004', label: 'Consolidação e Frutificação de Células, Pequenos Grupos e Redes de Discipulado', display_order: 8 },
  { id: '20000000-0000-4000-8000-000000000040', category_id: '10000000-0000-4000-8000-000000000004', label: 'Integração de Novos Convertidos e Processos de Discipulado Inicial', display_order: 9 },
  { id: '20000000-0000-4000-8000-000000000041', category_id: '10000000-0000-4000-8000-000000000004', label: 'Dinamização dos Ministérios de Louvor, Crianças, Teatro e Ação Social', display_order: 10 },
  { id: '20000000-0000-4000-8000-000000000042', category_id: '10000000-0000-4000-8000-000000000004', label: 'Missionários no Campo Transcultural, Sustento Financeiro e Vistos de Permanência', display_order: 11 },
  { id: '20000000-0000-4000-8000-000000000043', category_id: '10000000-0000-4000-8000-000000000004', label: 'Povos Não Alcançados, Perseguição Religiosa e Plantação de Novas Igrejas', display_order: 12 },
  { id: '20000000-0000-4000-8000-000000000044', category_id: '10000000-0000-4000-8000-000000000005', label: 'Cura de Enfermidades Desenganadas e Alta de Internações Longas', display_order: 1 },
  { id: '20000000-0000-4000-8000-000000000045', category_id: '10000000-0000-4000-8000-000000000005', label: 'Livramentos de Acidentes, Assaltos, Violência Urbana e Tragédias', display_order: 2 },
  { id: '20000000-0000-4000-8000-000000000046', category_id: '10000000-0000-4000-8000-000000000005', label: 'Conquista de Vagas de Emprego, Promoções e Estabilidade Financeira', display_order: 3 },
  { id: '20000000-0000-4000-8000-000000000047', category_id: '10000000-0000-4000-8000-000000000005', label: 'Reconciliações de Casamentos Desfeitos e Restauração de Filhos', display_order: 4 },
  { id: '20000000-0000-4000-8000-000000000048', category_id: '10000000-0000-4000-8000-000000000005', label: 'Aprovação em Exames Difíceis, Concursos e Conclusão de Estudos', display_order: 5 },
  { id: '20000000-0000-4000-8000-000000000049', category_id: '10000000-0000-4000-8000-000000000005', label: 'Batismos, Decisões por Cristo e Retorno de Irmãos Afastados', display_order: 6 },
  { id: '20000000-0000-4000-8000-000000000050', category_id: '10000000-0000-4000-8000-000000000005', label: 'Nascimento de Filhos, Aniversários e Celebrações de Bodas', display_order: 7 },
  { id: '20000000-0000-4000-8000-000000000051', category_id: '10000000-0000-4000-8000-000000000005', label: 'Aquisição de Casa Própria, Quitação de Dívidas e Conquistas Materiais', display_order: 8 },
  { id: '20000000-0000-4000-8000-000000000052', category_id: '10000000-0000-4000-8000-000000000005', label: 'Fidelidade de Deus em Tempos de Escassez e Sustento Diário', display_order: 9 },
  { id: '20000000-0000-4000-8000-000000000053', category_id: '10000000-0000-4000-8000-000000000005', label: 'Conclusão de Obras na Igreja, Expansão de Ministérios e Paz na Comunidade', display_order: 10 },
];

const resolveLocalSubcategories = (
  categoryId: string,
  allCategories: PastoralCategory[]
): PastoralSubcategory[] => {
  const direct = FALLBACK_SUBCATEGORIES.filter((item) => item.category_id === categoryId);

  if (direct.length > 0) {
    return direct;
  }

  const selectedCategory = allCategories.find((item) => item.id === categoryId);

  if (!selectedCategory) {
    return [];
  }

  const fallbackCategory = FALLBACK_CATEGORIES.find((item) => item.label === selectedCategory.label);

  if (!fallbackCategory) {
    return [];
  }

  return FALLBACK_SUBCATEGORIES.filter((item) => item.category_id === fallbackCategory.id);
};

export default function PastoralScreen() {
  const params = useLocalSearchParams<{ userId?: string | string[]; returnDashboardCard?: string | string[] }>();
  const routeUserId = Array.isArray(params.userId) ? params.userId[0] : params.userId;
  const router = useRouter();

  const accessStatus = useScreenAccessGuard({
    resourceKey: ACCESS_SCREEN.pastoral,
    deniedMessage: 'Você não tem permissão para abrir Coração Aberto.',
  });

  const [categories, setCategories] = useState<PastoralCategory[]>([]);
  const categoriesRef = useRef<PastoralCategory[]>([]);
  const [subcategories, setSubcategories] = useState<PastoralSubcategory[]>([]);
  const [selectedMotivo, setSelectedMotivo] = useState('');
  const [selectedSubmotivo, setSelectedSubmotivo] = useState('');
  const [selectedDestination, setSelectedDestination] =
    useState<PastoralRequestDestination | null>(null);
  const [requestFor, setRequestFor] = useState<PastoralBeneficiaryType | null>(null);
  const [beneficiaryName, setBeneficiaryName] = useState('');
  const [beneficiaryRelationship, setBeneficiaryRelationship] = useState('');
  const [beneficiaryDetails, setBeneficiaryDetails] = useState('');
  const [descricao, setDescricao] = useState('');
  const [resolvedUserId, setResolvedUserId] = useState<string | null>(routeUserId ?? null);
  const [userPhone, setUserPhone] = useState<string | null>(null);
  const [loadingCategories, setLoadingCategories] = useState(true);
  const [loadingSubcategories, setLoadingSubcategories] = useState(false);
  const [categoriesError, setCategoriesError] = useState<string | null>(null);
  const [subcategoriesError, setSubcategoriesError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingUserId, setLoadingUserId] = useState(!routeUserId);
  const [activeSelector, setActiveSelector] = useState<SelectorKind>(null);
  const motivoSelecionado =
    categories.find((motivo) => motivo.id === selectedMotivo) ?? null;
  const submotivoSelecionado =
    subcategories.find((submotivo) => submotivo.id === selectedSubmotivo) ?? null;
  const motivoSelecionadoLabel = motivoSelecionado?.label ?? null;
  const submotivoSelecionadoLabel = submotivoSelecionado?.label ?? null;
  const selectorOptions = useMemo(
    () => (activeSelector === 'motivo' ? categories : subcategories),
    [activeSelector, categories, subcategories]
  );
  const selectorTitle = activeSelector === 'motivo' ? 'Selecione um motivo' : 'Selecione um submotivo';

  const hasDraftContent = useMemo(
    () =>
      Boolean(
        selectedMotivo
        || selectedSubmotivo
        || selectedDestination
        || requestFor
        || beneficiaryName.trim()
        || beneficiaryRelationship.trim()
        || beneficiaryDetails.trim()
        || descricao.trim()
      ),
    [
      beneficiaryDetails,
      beneficiaryName,
      beneficiaryRelationship,
      descricao,
      requestFor,
      selectedDestination,
      selectedMotivo,
      selectedSubmotivo,
    ]
  );

  const resetPastoralForm = useCallback(() => {
    setSelectedMotivo('');
    setSelectedSubmotivo('');
    setSelectedDestination(null);
    setRequestFor(null);
    setBeneficiaryName('');
    setBeneficiaryRelationship('');
    setBeneficiaryDetails('');
    setDescricao('');
    setActiveSelector(null);
    setSubcategories([]);
    setSubcategoriesError(null);
  }, []);

  const handleClearForm = useCallback(async () => {
    if (!hasDraftContent) {
      return;
    }

    const confirmed = await confirmDialog(
      'Limpar pedido',
      'Deseja limpar todos os campos deste pedido em andamento?',
      'Limpar',
      'Cancelar',
      { destructive: true }
    );

    if (confirmed) {
      resetPastoralForm();
    }
  }, [hasDraftContent, resetPastoralForm]);

  const loadCategories = useCallback(async () => {
    setLoadingCategories(true);
    setCategoriesError(null);

    try {
      const { data, error } = await supabase
        .from('pastoral_reason_categories')
        .select('id, label, display_order')
        .eq('is_active', true)
        .order('display_order', { ascending: true });

      if (error) {
        throw error;
      }

      if (data?.length) {
        setCategories(data);
        return;
      }

      setCategories(FALLBACK_CATEGORIES);
      setCategoriesError(null);
    } catch (error) {
      console.error('Erro ao carregar motivos pastorais:', error);
      setCategories(FALLBACK_CATEGORIES);
      setCategoriesError('Não foi possível carregar os motivos do banco. Usando lista local.');
    } finally {
      setLoadingCategories(false);
    }
  }, []);

  useEffect(() => {
    categoriesRef.current = categories;
  }, [categories]);

  const loadSubcategories = useCallback(async (categoryId: string) => {
    setLoadingSubcategories(true);
    setSubcategoriesError(null);

    const applyLocalSubcategories = () => {
      const localSubcategories = resolveLocalSubcategories(categoryId, categoriesRef.current);

      setSubcategories(localSubcategories);

      if (!localSubcategories.length) {
        setSubcategoriesError(
          'Não foi possível carregar as situações deste motivo. Execute no Supabase o script scripts/pastoral-request-categories.sql.'
        );
      }

      return localSubcategories.length > 0;
    };

    try {
      const { data, error } = await supabase
        .from('pastoral_reason_subcategories')
        .select('id, category_id, label, display_order')
        .eq('category_id', categoryId)
        .eq('is_active', true)
        .order('display_order', { ascending: true });

      if (error) {
        throw error;
      }

      if (data?.length) {
        setSubcategories(data);
        return;
      }

      applyLocalSubcategories();
    } catch (error) {
      console.error('Erro ao carregar submotivos pastorais:', error);

      if (!applyLocalSubcategories()) {
        setSubcategoriesError('Não foi possível carregar as situações deste motivo. Tente novamente.');
      }
    } finally {
      setLoadingSubcategories(false);
    }
  }, []);

  useEffect(() => {
    void loadCategories();
  }, [loadCategories]);

  useEffect(() => {
    let isMounted = true;

    async function resolveUserId() {
      setLoadingUserId(true);

      try {
        const session = await resolvePastoralSessionProfile(routeUserId ?? null);

        if (!isMounted) {
          return;
        }

        if (session?.userId) {
          setResolvedUserId(session.userId);
          setUserPhone(session.phone);
          return;
        }

        setResolvedUserId(null);
        setUserPhone(null);
      } catch (error) {
        console.error('Erro ao carregar usuário autenticado:', error);
        if (isMounted) {
          setResolvedUserId(null);
          setUserPhone(null);
        }
      } finally {
        if (isMounted) {
          setLoadingUserId(false);
        }
      }
    }

    void resolveUserId();

    return () => {
      isMounted = false;
    };
  }, [routeUserId]);

  useEffect(() => {
    if (!selectedMotivo) {
      setSubcategories([]);
      setSubcategoriesError(null);
      setSelectedSubmotivo('');
      return;
    }

    if (loadingCategories) {
      return;
    }

    setSelectedSubmotivo('');
    void loadSubcategories(selectedMotivo);
  }, [loadSubcategories, loadingCategories, selectedMotivo]);

  const handleSubmit = async () => {
    const motivoLabel = motivoSelecionado?.label?.trim() ?? '';
    const situacaoLabel = submotivoSelecionado?.label?.trim() ?? '';

    const missingField = findPastoralRequestMissingField({
      selectedMotivo,
      selectedSubmotivo,
      motivoLabel,
      situacaoLabel,
      selectedDestination,
      requestFor,
      beneficiaryName,
      beneficiaryRelationship,
      beneficiaryDetails,
      descricao,
    });

    if (missingField) {
      await appAlert('Pedido incompleto', buildPastoralValidationAlertMessage(missingField));
      return;
    }

    setLoading(true);

    try {
      let userId = resolvedUserId;
      let phone = userPhone?.trim() ?? '';

      if (!userId || !phone) {
        const session = await resolvePastoralSessionProfile(routeUserId ?? null);

        if (session?.userId && session.phone) {
          userId = session.userId;
          phone = session.phone;
          setResolvedUserId(userId);
          setUserPhone(phone);
        }
      }

      if (!userId) {
        await appAlert('Erro', 'Não foi possível identificar seu cadastro. Faça login novamente.');
        return;
      }

      if (!phone) {
        await appAlert('Erro', 'Celular não identificado. Faça login novamente.');
        return;
      }

      const payload = buildPastoralRequestPayload({
        userId,
        phone,
        motivo: motivoLabel,
        situacao: situacaoLabel,
        description: descricao.trim(),
        categoryId: selectedMotivo,
        subcategoryId: selectedSubmotivo,
        destination: selectedDestination,
        requestFor,
        beneficiaryName,
        beneficiaryRelationship,
        beneficiaryDetails,
      });

      await submitPastoralRequest(payload);

      await appAlert('Sucesso', 'Pedido enviado! Estaremos orando por você.');
      router.replace(
        buildReturnToDashboardHref(resolveReturnDashboardCardParam(params) ?? 'pastoral')
      );
    } catch (err) {
      console.error('Erro ao enviar:', err);
      await appAlert('Erro', getSupabaseErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  const handleSelectOption = (value: string) => {
    if (activeSelector === 'motivo') {
      setSelectedMotivo(value);
    } else if (activeSelector === 'submotivo') {
      setSelectedSubmotivo(value);
    }

    setActiveSelector(null);
  };

  const handleBackToDashboard = () => {
    router.replace(
      buildReturnToDashboardHref(resolveReturnDashboardCardParam(params) ?? 'pastoral')
    );
  };

  const handleOpenHistory = async () => {
    if (!resolvedUserId) {
      void appAlert('Atenção', 'Faça login novamente para ver seus pedidos.');
      return;
    }

    const allowed = await sessionHasAccess('screen', ACCESS_SCREEN.pastoralHistory, 'view');

    if (!allowed) {
      void appAlert(
        'Sem permissão',
        'Você não tem permissão para ver seus pedidos pastorais.'
      );
      return;
    }

    router.push({
      pathname: '/pastoral-history',
      params: { userId: resolvedUserId },
    });
  };

  return (
    <ScreenAccessGate status={accessStatus}>
    <LinearGradient colors={['#0f172a', '#020617']} style={styles.container}>
      <SafeAreaView style={styles.container}>
        <Modal
          visible={activeSelector !== null}
          transparent
          animationType="fade"
          onRequestClose={() => setActiveSelector(null)}
        >
          <Pressable style={styles.selectorBackdrop} onPress={() => setActiveSelector(null)}>
            <Pressable style={styles.selectorModalCard} onPress={() => undefined}>
              <Text style={styles.selectorModalTitle}>{selectorTitle}</Text>
              <ScrollView
                style={styles.selectorOptionsScroll}
                contentContainerStyle={styles.selectorOptionsContent}
                showsVerticalScrollIndicator
              >
                {selectorOptions.map((option) => {
                  const isSelected =
                    activeSelector === 'motivo'
                      ? option.id === selectedMotivo
                      : option.id === selectedSubmotivo;

                  return (
                    <TouchableOpacity
                      key={option.id}
                      style={[
                        styles.selectorOptionButton,
                        isSelected && styles.selectorOptionButtonSelected,
                      ]}
                      onPress={() => handleSelectOption(option.id)}
                      activeOpacity={0.85}
                    >
                      <Text
                        style={[
                          styles.selectorOptionText,
                          isSelected && styles.selectorOptionTextSelected,
                        ]}
                      >
                        {option.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
              <TouchableOpacity
                style={styles.selectorCloseButton}
                onPress={() => setActiveSelector(null)}
                activeOpacity={0.85}
              >
                <Text style={styles.selectorCloseButtonText}>Fechar</Text>
              </TouchableOpacity>
            </Pressable>
          </Pressable>
        </Modal>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.screenLayout}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 8 : 0}>
          <View style={styles.headerBar}>
            <View style={styles.headerTitles}>
              <Text style={styles.title}>Coração Aberto</Text>
              <Text style={styles.subtitle}>Pedido de cuidado pastoral</Text>
            </View>
            <TouchableOpacity
              accessibilityLabel="Limpar pedido"
              accessibilityRole="button"
              accessibilityState={{ disabled: !hasDraftContent || loading }}
              activeOpacity={0.85}
              disabled={!hasDraftContent || loading}
              onPress={() => void handleClearForm()}
              style={[
                styles.headerClearButton,
                (!hasDraftContent || loading) && styles.headerActionButtonDisabled,
              ]}>
              <FontAwesome name="eraser" size={18} color="#FCA5A5" />
            </TouchableOpacity>
            <TouchableOpacity
              accessibilityLabel="Ver meus pedidos"
              accessibilityRole="button"
              activeOpacity={0.85}
              disabled={loadingUserId || !resolvedUserId}
              onPress={handleOpenHistory}
              style={[
                styles.headerHistoryButton,
                (loadingUserId || !resolvedUserId) && styles.headerActionButtonDisabled,
              ]}>
              <FontAwesome name="history" size={20} color="#C4B5FD" />
            </TouchableOpacity>
            <TouchableOpacity
              accessibilityLabel="Voltar"
              accessibilityRole="button"
              activeOpacity={0.85}
              onPress={handleBackToDashboard}
              style={styles.headerBackButton}>
              <Text style={styles.headerBackText}>Voltar</Text>
            </TouchableOpacity>
          </View>

          {!loadingUserId && !resolvedUserId ? (
            <Text style={styles.statusBannerError}>
              Faça login novamente para enviar um pedido.
            </Text>
          ) : null}

          <ScrollView
            style={styles.formScroll}
            contentContainerStyle={styles.formScrollContent}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}>
            <View style={styles.fieldStack}>
              <View style={styles.fieldBlock}>
                <SectionLabel>Motivo</SectionLabel>
                <TouchableOpacity
                  style={[
                    styles.selectorField,
                    motivoSelecionadoLabel && styles.selectorFieldSelected,
                  ]}
                  onPress={() => setActiveSelector('motivo')}
                  activeOpacity={0.85}
                  disabled={loadingCategories || !categories.length}>
                  <Text
                    style={[
                      styles.selectorFieldValue,
                      !motivoSelecionadoLabel && styles.selectorFieldPlaceholder,
                    ]}
                    numberOfLines={4}>
                    {loadingCategories
                      ? 'Carregando...'
                      : motivoSelecionadoLabel ?? 'Selecionar'}
                  </Text>
                </TouchableOpacity>
              </View>

              <View style={styles.fieldBlock}>
                <SectionLabel>Situação</SectionLabel>
                <TouchableOpacity
                  style={[
                    styles.selectorField,
                    submotivoSelecionadoLabel && styles.selectorFieldSelected,
                    !motivoSelecionado && styles.selectorFieldDisabled,
                  ]}
                  onPress={() => {
                    if (motivoSelecionado && subcategories.length) {
                      setActiveSelector('submotivo');
                    }
                  }}
                  activeOpacity={0.85}
                  disabled={!motivoSelecionado || loadingSubcategories || !subcategories.length}>
                  <Text
                    style={[
                      styles.selectorFieldValue,
                      !submotivoSelecionadoLabel && styles.selectorFieldPlaceholder,
                    ]}
                    numberOfLines={4}>
                    {!motivoSelecionado
                      ? 'Aguardando motivo'
                      : loadingSubcategories
                        ? 'Carregando...'
                        : submotivoSelecionadoLabel ?? 'Selecionar'}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>

            {categoriesError ? (
              <TouchableOpacity
                style={styles.inlineRetry}
                onPress={() => void loadCategories()}
                activeOpacity={0.85}>
                <Text style={styles.inlineRetryText}>Recarregar motivos</Text>
              </TouchableOpacity>
            ) : null}
            {subcategoriesError ? <Text style={styles.inlineError}>{subcategoriesError}</Text> : null}

            <SectionLabel spaced>Este pedido é para</SectionLabel>
            <SegmentChipRow
              options={PASTORAL_BENEFICIARY_TYPES.map((option) => ({
                value: option,
                label: PASTORAL_BENEFICIARY_META[option].shortLabel,
                accessibilityLabel: PASTORAL_BENEFICIARY_META[option].label,
              }))}
              selectedValue={requestFor}
              onSelect={(option) => {
                setRequestFor(option);
                if (option === 'self') {
                  setBeneficiaryName('');
                  setBeneficiaryRelationship('');
                  setBeneficiaryDetails('');
                } else if (option === 'family') {
                  setBeneficiaryDetails('');
                } else {
                  setBeneficiaryRelationship('');
                }
              }}
            />

            {requestFor === 'family' || requestFor === 'third_party' ? (
              <View style={styles.beneficiaryFields}>
                <SectionLabel>Nome do necessitado</SectionLabel>
                <TextInput
                  style={styles.inputSingleLine}
                  placeholder="Nome completo"
                  placeholderTextColor="#64748b"
                  value={beneficiaryName}
                  onChangeText={setBeneficiaryName}
                  autoCapitalize="words"
                />

                {requestFor === 'family' ? (
                  <>
                    <SectionLabel spaced>Grau de parentesco</SectionLabel>
                    <TextInput
                      style={styles.inputSingleLine}
                      placeholder="Ex.: cônjuge, filho(a), pai, mãe..."
                      placeholderTextColor="#64748b"
                      value={beneficiaryRelationship}
                      onChangeText={setBeneficiaryRelationship}
                      autoCapitalize="words"
                    />
                  </>
                ) : (
                  <>
                    <SectionLabel spaced>Especifique (terceiros)</SectionLabel>
                    <TextInput
                      style={styles.inputSingleLine}
                      placeholder="Ex.: vizinho, colega de trabalho, amigo..."
                      placeholderTextColor="#64748b"
                      value={beneficiaryDetails}
                      onChangeText={setBeneficiaryDetails}
                      autoCapitalize="sentences"
                    />
                  </>
                )}
              </View>
            ) : null}

            <SectionLabel spaced>Encaminhar para</SectionLabel>
            <SegmentChipRow
              options={PASTORAL_DESTINATIONS.map((option) => ({
                value: option,
                label: option === 'Sigilo Pastoral' ? 'Sigilo pastoral' : 'Intercessão',
                accessibilityLabel: PASTORAL_DESTINATION_META[option].title,
              }))}
              selectedValue={selectedDestination}
              onSelect={setSelectedDestination}
            />
            {selectedDestination ? (
              <Text style={styles.destinationActiveHint}>
                {PASTORAL_DESTINATION_META[selectedDestination].hint}
              </Text>
            ) : null}

            <SectionLabel spaced>Seu pedido</SectionLabel>
            <TextInput
              style={styles.input}
              placeholder="Descreva brevemente..."
              placeholderTextColor="#64748b"
              value={descricao}
              onChangeText={setDescricao}
              multiline
              numberOfLines={6}
              textAlignVertical="top"
            />
          </ScrollView>

          <View style={styles.footerBar}>
            <View style={styles.footerActions}>
              <TouchableOpacity
                accessibilityLabel="Enviar pedido pastoral"
                accessibilityRole="button"
                activeOpacity={0.85}
                style={[styles.btnSubmitFull, (loading || loadingUserId) && styles.btnSubmitDisabled]}
                onPress={() => {
                  void handleSubmit();
                }}
                disabled={loading || loadingUserId}>
                {loading ? (
                  <ActivityIndicator color="#FFF" />
                ) : (
                  <Text style={styles.btnSubmitFullText}>Enviar pedido</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </LinearGradient>
    </ScreenAccessGate>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  screenLayout: {
    flex: 1,
  },
  headerBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingTop: 4,
    paddingBottom: 8,
  },
  headerBackButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#64748b',
    backgroundColor: 'rgba(51, 65, 85, 0.55)',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 6,
  },
  headerBackText: {
    color: '#E2E8F0',
    fontSize: 14,
    fontWeight: '800',
  },
  headerTitles: {
    flex: 1,
    minWidth: 0,
  },
  headerClearButton: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 4,
    backgroundColor: 'rgba(239, 68, 68, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.35)',
  },
  headerHistoryButton: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 6,
    backgroundColor: 'rgba(168, 85, 247, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(168, 85, 247, 0.35)',
  },
  headerActionButtonDisabled: {
    opacity: 0.45,
  },
  title: {
    fontSize: 20,
    fontWeight: '800',
    color: '#FFF',
  },
  subtitle: {
    color: '#94A3B8',
    fontSize: 12,
    marginTop: 2,
  },
  statusBanner: {
    color: '#CBD5E1',
    fontSize: 12,
    textAlign: 'center',
    marginBottom: 6,
    paddingHorizontal: 16,
  },
  statusBannerError: {
    color: '#FCA5A5',
    fontSize: 12,
    textAlign: 'center',
    marginBottom: 6,
    paddingHorizontal: 16,
  },
  formScroll: {
    flex: 1,
  },
  formScrollContent: {
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  fieldStack: {
    flexDirection: 'column',
    alignItems: 'stretch',
    gap: 12,
    marginBottom: 10,
  },
  fieldBlock: {
    width: '100%',
    alignSelf: 'stretch',
  },
  label: {
    color: '#10b981',
    marginBottom: 4,
    fontWeight: '600',
    fontSize: 13,
  },
  labelSpaced: {
    marginTop: 4,
  },
  selectorField: {
    backgroundColor: 'rgba(30, 41, 59, 0.7)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#334155',
    minHeight: 56,
    justifyContent: 'center',
    paddingHorizontal: 10,
    paddingVertical: 10,
  },
  selectorFieldSelected: {
    borderColor: '#10b981',
    backgroundColor: 'rgba(16, 185, 129, 0.12)',
  },
  selectorFieldDisabled: {
    opacity: 0.6,
  },
  selectorFieldValue: {
    color: '#F8FAFC',
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '700',
  },
  selectorFieldPlaceholder: {
    color: '#CBD5E1',
    fontWeight: '500',
  },
  inlineRetry: {
    alignSelf: 'flex-start',
    marginBottom: 8,
  },
  inlineRetryText: {
    color: '#C4B5FD',
    fontSize: 12,
    fontWeight: '700',
  },
  inlineError: {
    color: '#FCA5A5',
    fontSize: 12,
    marginBottom: 8,
  },
  segmentRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 6,
  },
  segmentOption: {
    flex: 1,
    minHeight: 44,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#334155',
    backgroundColor: 'rgba(30, 41, 59, 0.7)',
    paddingHorizontal: 8,
    paddingVertical: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  segmentOptionSelected: {
    borderColor: '#a855f7',
    backgroundColor: 'rgba(168, 85, 247, 0.2)',
  },
  segmentOptionText: {
    color: '#CBD5E1',
    fontSize: 12,
    fontWeight: '700',
    textAlign: 'center',
    lineHeight: 16,
  },
  segmentOptionTextSelected: {
    color: '#F5F3FF',
  },
  destinationActiveHint: {
    color: '#64748B',
    fontSize: 11,
    lineHeight: 15,
    marginBottom: 8,
  },
  beneficiaryFields: {
    marginBottom: 4,
  },
  inputSingleLine: {
    backgroundColor: 'rgba(30, 41, 59, 0.7)',
    borderWidth: 1,
    borderColor: '#334155',
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderRadius: 12,
    color: '#FFF',
    fontSize: 15,
    marginBottom: 4,
  },
  input: {
    backgroundColor: 'rgba(30, 41, 59, 0.7)',
    borderWidth: 1,
    borderColor: '#334155',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    color: '#FFF',
    minHeight: 148,
    maxHeight: 168,
    fontSize: 15,
    lineHeight: 22,
  },
  footerBar: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 12,
    borderTopWidth: 1,
    borderTopColor: '#334155',
    backgroundColor: 'rgba(2, 6, 23, 0.92)',
  },
  footerActions: {
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: 10,
  },
  btnSubmitFull: {
    flex: 1,
    backgroundColor: '#a855f7',
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnSubmitFullText: {
    color: '#FFF',
    fontSize: 15,
    fontWeight: '800',
  },
  btnSubmitDisabled: {
    opacity: 0.6,
  },
  errorText: {
    color: '#FCA5A5',
    marginTop: 8,
  },
  selectorBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(2, 6, 23, 0.75)',
    justifyContent: 'center',
    padding: 24,
  },
  selectorModalCard: {
    borderRadius: 24,
    borderWidth: 1,
    borderColor: '#334155',
    backgroundColor: '#0f172a',
    maxHeight: '75%',
    overflow: 'hidden',
  },
  selectorModalTitle: {
    color: '#F8FAFC',
    fontSize: 18,
    fontWeight: '800',
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 14,
  },
  selectorOptionsScroll: {
    maxHeight: 420,
  },
  selectorOptionsContent: {
    paddingHorizontal: 12,
    paddingBottom: 10,
  },
  selectorOptionButton: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#334155',
    backgroundColor: 'rgba(30, 41, 59, 0.45)',
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 8,
  },
  selectorOptionButtonSelected: {
    borderColor: '#10b981',
    backgroundColor: 'rgba(16, 185, 129, 0.18)',
  },
  selectorOptionText: {
    color: '#E2E8F0',
    fontSize: 14,
    lineHeight: 20,
  },
  selectorOptionTextSelected: {
    color: '#F8FAFC',
    fontWeight: '700',
  },
  selectorCloseButton: {
    margin: 12,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#a855f7',
    backgroundColor: 'rgba(168, 85, 247, 0.16)',
    paddingVertical: 14,
    alignItems: 'center',
  },
  selectorCloseButtonText: {
    color: '#E9D5FF',
    fontWeight: '800',
  },
});